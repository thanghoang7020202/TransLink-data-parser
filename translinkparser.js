import fetch from 'node-fetch';
// import fs promises from 'fs/promises';
import fs, {promises as fsPromises} from 'fs';
import {parse} from 'csv-parse';
import { csvDF } from './dataframe.js';
import { join } from 'path';
import { to_date, time_differ, to_minutes, convertToBrisbaneTime } from './utils.js'; // Time related utility functions

// Read the CSV file and parse it to JSON object
import promptsync from 'prompt-sync'; // prompt-sync module
const prompt = promptsync({sigint: true} );  

const TRIP_UPDATES_URL = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";
const VEHICLE_POSITIONS_URL = "http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json";
const CACHE_FOLDER = "./cached-data/";
const messageSaveCache = (filenameAppend) => `Saved a JSON cache file called "${filenameAppend}".`;
const messageReadCache = (filenameAppend) => `Read a JSON cache file called "${filenameAppend}".`;
const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const BRISBANE_TIMEZONE = 10; // Brisbane timezone is UTC+10
const TEN_MINUTES = 600000; // 10 minutes in milliseconds
const FIVE_MINUTE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let firstStart = true; // first run of the program

let isLoopRoute = false;
let trip_updates = [];
let vehicle_positions = [];
let alerts = [];

let joinedDf;
let tripsDF;
let stopTimesDF;
let stopsDF;
let calendarDF;
let calendarDatesDF;

/**
 * Load the static data from the CSV files
 */
async function staticData() {
    joinedDf = await csvDF().loadCSV('./static-data/routes.txt');
    tripsDF = await csvDF().loadCSV('./static-data/trips.txt');
    joinedDf.filter('route_type', '3');

    stopTimesDF = await csvDF().loadCSV('./static-data/stop_times.txt');

    stopsDF = await csvDF().loadCSV('./static-data/stops.txt');

    calendarDF = await csvDF().loadCSV('./static-data/calendar.txt');

    calendarDatesDF = await csvDF().loadCSV('./static-data/calendar_dates.txt');
}
 


/**
 * This function will save a JSON cache file with the specified filename & data.
 * @param {string} filenameAppend - The string to append to the JSON filename.
 * @param {string} data - The string containing JSON data to save.
 */
async function save_cache(filenameAppend, data) {
    try {
        filenameAppend = CACHE_FOLDER + filenameAppend + ".json";
        await fsPromises.writeFile(filenameAppend, JSON.stringify(data));
            console.log(messageSaveCache(filenameAppend));
    } catch(error) {
        console.log(error);
    }
}

/**
 * This function will read a JSON cache file with the specified filename.
 * @param {string} filenameAppend - The string to append to the JSON filename.
 * @returns {string} - The string containing JSON data.
 */
async function read_cache(filenameAppend) {
    try {
        filenameAppend = CACHE_FOLDER + filenameAppend + ".json";
        const data = await fsPromises.readFile(filenameAppend, 'utf8');
        console.log(messageReadCache(filenameAppend));
        return JSON.parse(data);
    } catch(error) {
        console.log("The cache file does not exist in cache-data folder or could not be read.");
        console.log("Starting fresh with API data.");
    }
    return null;
}

/**
 * This function will clear the cache directory.
 * @returns {void}
 */
function cache_prune() {
    try {
        const files = fs.readdirSync(CACHE_FOLDER);
        for (const file of files) {
            fs.unlinkSync(CACHE_FOLDER + file);
            //console.info("Deleted file:", file);
        }
        //console.info("Cache directory cleared.");
    } catch (error) {
        console.error("Cache prune error:", error);
    }
}


/**
 * Fetch data from the API
 * @param {string} api_url - The URL of the API
 * @returns {Promise} - A promise that resolves to the JSON data
 */
async function fetch_data(api_url) {
    let response = await fetch(api_url) // fetch returns a promise
    .then( (response) => {
        return response; 
    })
    .catch((err) => {
        console.log("rejected", err);
    });

    return await response.json(); // .json() returns a promise
}

/**
 * Initialize the data by fetching from the API or reading from the cache
 * @param {string} tripUpdatesUrl - The URL for trip updates
 * @param {string} vehiclePositionsUrl - The URL for vehicle positions
 * @param {string} cacheKey - The cache key to use for the cache files
 * @returns {Array} - An array containing trip_updates, vehicle_positions, and alerts
 */
async function initializeData(tripUpdatesUrl, vehiclePositionsUrl, cacheKey = "all") {
    let trip_updates = [];
    let vehicle_positions = [];

    let allData = await read_cache(cacheKey);

    if (allData !== null && !firstStart) {
        try {
            trip_updates = allData.trip_updates || [];
            vehicle_positions = allData.vehicle_positions || [];
        } catch (error) {
            console.error("Error parsing JSON from cache file:", error.message);
        }
    } else {
        // If cache files do not exist, fetch data from the API
        trip_updates = await fetch_data(tripUpdatesUrl);
        vehicle_positions = await fetch_data(vehiclePositionsUrl);

        allData = {
            trip_updates,
            vehicle_positions
        };

        // Store JSON objects into cache files
        await save_cache(cacheKey, allData);
    }

    return [ trip_updates, vehicle_positions ];
}

/**
 * trigger cache prune every 5 minutes
 */
async function triggerEveryFiveMinutes() {
    //console.info("5 minutes have passed. Timer triggered.");
    cache_prune();
    
    // re-read the cache files
    trip_updates = await fetch_data(TRIP_UPDATES_URL);
    vehicle_positions = await fetch_data(VEHICLE_POSITIONS_URL);



    // Store JSON objects into cache files
    let allData = {
        trip_updates,
        vehicle_positions
    };
    await save_cache("all", allData);
}

/**
 * Get all stops of a route
 * Method: route_short_name -> route_id -> trip_id -> (list of) stop_id -> (list of) stop_name
 * Handle loop routes or inbound-outbound routes
 * @param {string} route_short_name - The route short name
 * @returns {Array} - List of stops
 */
function get_stops(route_id) {
    let trips = tripsDF.getData();
    let stop_times = stopTimesDF.getData();
    let stops = stopsDF.getData();
    
    // Filter trips by route_id
    let inbound_trips = trips.filter(trip => trip.route_id === route_id && trip.direction_id === "0");
    let outbound_trips = trips.filter(trip => trip.route_id === route_id && trip.direction_id === "1");
    //console.info("Inbound Trips length:", inbound_trips.length);
    //console.info("Outbound Trips length:", outbound_trips.length);

    // Get stop_ids for inbound and outbound trips
    let inbound_stop_ids = stop_times.filter(stop_time => inbound_trips.map(trip => trip.trip_id).includes(stop_time.trip_id));
    let outbound_stop_ids = stop_times.filter(stop_time => outbound_trips.map(trip => trip.trip_id).includes(stop_time.trip_id));
    //console.info("Inbound Stop IDs length:", inbound_stop_ids.length);
    //console.info("Outbound Stop IDs length:", outbound_stop_ids.length);

    // Sort stops by stop_sequence
    inbound_stop_ids.sort((a, b) => a.stop_sequence - b.stop_sequence);
    outbound_stop_ids.sort((a, b) => a.stop_sequence - b.stop_sequence);
    //console.info("Inbound Stop IDs (Sorted) length:", inbound_stop_ids.length);
    //console.info("Outbound Stop IDs (Sorted) length:", outbound_stop_ids.length);

    // Get the unique stops (assuming stop names might be repeated)
    let inbound_stops = inbound_stop_ids.map(stop_time => stops.find(stop => stop.stop_id === stop_time.stop_id).stop_name);
    let outbound_stops = outbound_stop_ids.map(stop_time => stops.find(stop => stop.stop_id === stop_time.stop_id).stop_name);
    ////console.info("Inbound Stops:", inbound_stops);

    // Combine inbound and outbound stops, solving route loops/inbound-outbound routes
    let all_stops;

    // If it's a loop route (outbound_trips is []), the last stop should be the same as the first stop, but add it explicitly
    if (outbound_trips.length !== 0) {
        // Return the combined inbound and outbound stops (Allow duplicates within inbound and outbound)
        all_stops = [...new Set([...inbound_stops]), ...new Set([...outbound_stops])];
    } else {
        isLoopRoute = true;
        all_stops = [...new Set([...inbound_stops])];
        all_stops.push(all_stops[0]); // Add the starting stop at the end to complete the loop
    }

    return all_stops;
}

/**
 * Print the list of stops
 * @param {Array} stopsList - List of stops
 */
function print_stops(stopsList) {
    for (let i = 0; i < stopsList.length; i++) {
        console.log(i + 1 + ". " + stopsList[i]);
    }
}

/**
 * Get the live arrival times and bus positions for a given trip
 * @param {string} tripId - The trip ID
 * @param {Array} tripUpdatesLive - Array of live trip updates from the GTFS dataset
 * @param {Array} vehiclePositionsLive - Array of live vehicle positions from the GTFS dataset
 * @returns {Array} - An array containing the live arrival time and bus position
 */
async function getLiveArrivalTimesAndPositions(tripId, tripUpdatesLive, vehiclePositionsLive) {
    let liveArrivalTime = "-";
    let liveBusPosition = "-";

    // Find the trip update for the given tripId
    const tripUpdate = tripUpdatesLive.find(update => update.tripUpdate.trip.tripId === tripId);
    console.info("Trip Update:", tripUpdate);
    if (tripUpdate && tripUpdate.tripUpdate.stopTimeUpdate) {
        const stopUpdate = tripUpdate.tripUpdate.stopTimeUpdate.find(update => update.stopId); // Assuming stopId is available
        console.info("Stop Update:", stopUpdate);
        if (stopUpdate && stopUpdate.arrival) {
            liveArrivalTime = stopUpdate.arrival.time; // Use the arrival time from trip update
            console.info("Live Arrival Time:", liveArrivalTime);
        }
    }

    // Find the vehicle position for the given tripId
    const vehiclePosition = vehiclePositionsLive.find(position => position.vehicle.trip.tripId === tripId);
    if (vehiclePosition) {
        liveBusPosition = {
            latitude: vehiclePosition.vehicle.position.latitude,
            longitude: vehiclePosition.vehicle.position.longitude
        };
    }
    console.info("Live Bus Position:", liveBusPosition);

    return [liveArrivalTime, liveBusPosition];
}


// @ts-check
async function main() {
    // Set up the interval to trigger the function every 5 minutes
    const timerId = setInterval(triggerEveryFiveMinutes, FIVE_MINUTE_INTERVAL);
    
    console.log("Welcome to the South East Queensland Route Planner!");
    // create a variable to store the combination to different txt files in the static-data folder
    let routeShortName = "";
    let route_id = "";
    let stopsTuple = [];
    let dateStr = "";
    let date = "";
    let time = "";
    let hour = "", minute = "";
    let stopsList = [];

    // prompting IU
    while (true) {
        

        try {
            routeShortName = await prompt("What Bus Route would you like to take?"); // "66" // 
            // check if the bus route isvalid and exists in the routes.txt file
            //console.info("Expected type: " + .routetypeof routes_short_name);
            //console.log(joinedDf.getData().length);
            await staticData(); // load the static data
            route_id = joinedDf.find('route_short_name', routeShortName).route_id;
        
            if (!route_id) {
                throw new Error("Invalid Bus Route");
            }
            //console.info("Bus Route: " + routeShortName + " of type " + typeof routeShortName + " with route_id: " + route_id);
            
        } catch (error) {
            console.error(error.message);
            console.error("Please enter a valid bus route.");
            continue;
        }
        // print all stops for the bus route from route_url
        //console.info("Joined DF length (before) - with route_id:", joinedDf.getData().length);
        joinedDf.filter('route_id', route_id); 
        //console.info("Joined DF length (after):", joinedDf.getData().length);
        stopsList = get_stops(route_id);
        print_stops(stopsList);
        // make stopsList as tuple with index and stop name
        stopsTuple = stopsList.map((stop, index) => [index + 1, stop]);
        while (true) {
            let [start_stop, end_stop] = [];
            try {
                let startEnd =  await prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop" "14 - 20"; // "2 - 7"; //
                [start_stop, end_stop] = startEnd.split("-").map(stop => stop.trim()).map(Number);
                // check if the start and end stops are valid in stopTuple (to string)
                if (!stopsTuple.some(stop => stop[0] === start_stop) || !stopsTuple.some(stop => stop[0] === end_stop)) {
                    throw new Error("Invalid Stops");
                }
                
            } catch (error) {
                console.error(error.message);
                console.error("Please follow the format and enter a valid number for the stop");
                continue;
            }
            
            while (true) {
                try {
                    dateStr = await prompt("What date will you take the route?"); // "2024-08-19"//
                    // check if the time is valid: Year, month & day in https://tc39.es/ecma262/#sec-date-time-string-format (YYYY-MM-DD)
                    if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        throw new Error("Invalid Time");
                    }
                    // check if the date is valid
                    date = new Date(dateStr);
                    //console.info("Date:", date);
                    if (date.toString() === "Invalid Date") {
                        throw new Error("Invalid Date");
                    }

                } catch (error) {
                    console.error(error.message);
                    console.error("Incorrect date format. Please use YYYY-MM-DD");
                    continue;
                }
                
                while (true) {
                    try {
                        time = await prompt("What time will you leave?"); // "06:57"//
                        // check if the time is valid: Hour & minutes in 24 hour time in https://tc39.es/ecma262/#sec-date-time-stringformat (HH:mm)
                        if (!time.match(/^\d{2}:\d{2}$/)) {
                            throw new Error("Invalid Time");
                        }
                        // check if the time is valid
                        [hour, minute] = time.split(":").map(Number);
                        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                            throw new Error("Invalid Time");
                        }
                    } catch (error) {
                        console.error(error.message);
                        console.error("Incorrect time format. Please use HH:mm");
                        continue;
                    }

                    let formattedDate = dateStr.replace(/-/g, ""); // remove the hyphens to match the format in the calendar_dates.txt file
                    const minutes = hour * 60 + minute;
                    // get the day of the week
                    const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
                    ////console.info("Day of the week:", dayOfWeek);

                    // print to verify the user input is correct
                    //console.info("route_id:", route_id, "date:", date, "start_stop:", start_stop, "end_stop:", end_stop, "time:", time);
                    
                    //console.info("tripsDF length (before) - with direction id", tripsDF.getData().length);
                    if (!isLoopRoute && (start_stop > Math.floor(stopsList.length / 2))) {
                            tripsDF.filter('direction_id', '1'); // outbound
                            //console.info("This is an outbound route.");
                        } else {
                            tripsDF.filter('direction_id', '0'); // inbound
                            //console.info("This is an inbound route.");
                        }
                    //console.info("tripsDF length (after):", tripsDF.getData().length);

                    //console.info("Calendar DF DF length (before):", stopTimesDF.getData().length);
                    calendarDF.join(calendarDatesDF, 'service_id'); // calendarDF + calendarDatesDF
                    //console.info("Calendar DF length (after):", calendarDF.getData().length);
                    
                    //console.info("Calendar Dates DF length (before):", calendarDatesDF.getData().length);
                    calendarDF.filterBy(cal => {
                        let startDate = to_date(cal.start_date);
                        let endDate = to_date(cal.end_date);
                        let exceptionDate = calendarDatesDF.findBy(eDate => eDate.service_id === cal.service_id && to_date(eDate.date) === date);
                        
                        if (exceptionDate) {
                            if (cal.exception_type === "1") {
                                return true; // add the exception dates
                            }
                            if (cal.exception_type === "2") {
                                return false; // remove the exception dates
                            }
                        }                        
                        return cal[dayOfWeek] === "1"
                            && date >= startDate
                            && date <= endDate;
                    });                    
                    //console.info("Filtered Calendar DF length (after):", calendarDF.getData().length);
                    
                    
                    //console.info("Stop Times DF length (before):", stopTimesDF.getData().length);
                    stopsDF.filterBy(stop => stop.stop_name === stopsList[start_stop - 1] || stop.stop_name === stopsList[end_stop - 1]);
                    //console.info("Filtered Stops DF length (after):", stopsDF.getData().length);

                    joinedDf.join(tripsDF, 'route_id'); // routeDf + tripsDF
                    //console.info("Joined DF length (route_id):", joinedDf.getData().length);

                    joinedDf.join(stopTimesDF, 'trip_id'); // routeDf + tripsDF + stopTimesDF
                    //console.info("Filtered joined DF length (trip_id):", joinedDf.getData().length);
                    
                    joinedDf.join(stopsDF, 'stop_id'); // routeDf + tripsDF + stopTimesDF + stopsDF
                    //console.info("Filtered joined DF length (stop_id):", joinedDf.getData().length);
                    ////console.info("Joined DF:", joinedDf.getData());

                    joinedDf.join(calendarDF, 'service_id'); // routeDf + tripsDF + stopTimesDF + stopsDF + calendarDF + calendarDatesDF
                    //console.info("Filtered joined DF length (service_id):", joinedDf.getData().length);
                    
                    //console.info("joinedDf length (before) - with start_stop:", joinedDf.getData().length);
                    let startTimes = joinedDf.extractBy(stop => {               // get all the valid stops
                        // if the stop is the first stop, use departure_time instead of arrival_time
                        
                        let arrival_time = (start_stop === 1) ? stop.departure_time : stop.arrival_time;

                        ////console.info("Arrival Time:", arrival_time);
                        const arrivalList = arrival_time.split(':').map(Number)
                        const arrivalInMinutes = arrivalList[0] * 60 + arrivalList[1];
                        
                        const timeDifference = arrivalInMinutes - minutes;
                        ////console.info("Arrival Time in Minutes:", arrivalInMinutes, "Time in Minutes:", minutes, "Time Difference:", timeDifference);
                        return timeDifference >= 0 && timeDifference < 10 && stop.stop_name.toLowerCase() === stopsList[start_stop - 1].toLowerCase();
                    });
                    //console.info("startTimes length:", startTimes.length);

                    // sort the trips by arrival time and trip id
                    //joinedDf.sortBy('arrival_time').sortBy('trip_id');
                    //console.info("Joined DF length (after) - with start_stop:", joinedDf.getData().length);

                    // make a extractPairs list that stores each pair of corresponding [start stop, end stop] for each trip
                    startTimes = startTimes.map(stop => stop.arrival_time);
                    let extractPairs = [];

                    // Iterate through each row `a` in `joinedDf`
                    joinedDf.getData().forEach((a) => {
                        // For each `a`, iterate through each row `b` in `joinedDf`
                        joinedDf.getData().forEach((b) => {
                            // Check if the pair (a, b) satisfies the given conditions
                            if (a.trip_id === b.trip_id && 
                                a.stop_name.toLowerCase() === stopsList[start_stop - 1].toLowerCase() && 
                                b.stop_name.toLowerCase() === stopsList[end_stop - 1].toLowerCase() &&
                                startTimes.includes(a.arrival_time)) {
                                // If conditions are met, add the pair [a, b] to extractPairs
                                extractPairs.push([a, b]);
                            }
                        });
                    });
                    
                    //console.info("Extract Pairs:", extractPairs);
                    
                    let objects = [];
                    extractPairs.forEach(element => { // for each object
                        let obj = {};                                   // create an object to store the onject details
                        let estimatedTime = "null"                      // estimated time to reach the end stop from the start stop 
                        //console.info("element[0].arrival_time:", element[0].arrival_time, "element[1].arrival_time:", element[1].arrival_time);
                        if (to_minutes(element[0].arrival_time) > to_minutes(element[1].arrival_time)) {
                            // skip and go to the next pair
                            return;
                        }
                        estimatedTime = time_differ(element[0].arrival_time, element[1].arrival_time); // calculate the estimated time to reach the end stop from the start stop
                        //console.info("Estimated Time:", estimatedTime);

                        //console.info(element[0].trip_id, trip_updates.entity[0].tripUpdate.trip.tripId);
                        if (trip_updates.entity === undefined || vehicle_positions.entity === undefined) {
                            console.error("No trip updates or vehicle positions available.");
                        } else {
                            //console.info("Trip Updates:", trip_updates.entity[0].id);
                        }

                    
                        let tripId = element[0].trip_id;
                        let [ liveArrivalTime, liveBusPosition ] = getLiveArrivalTimesAndPositions(tripId, trip_updates.entity, vehicle_positions.entity);
                        obj = {
                            "Route Short Name": routeShortName,
                            "Trip ID": element[0].trip_id,
                            "Route Long Name": element[0].route_long_name,
                            "Service ID": element[0].service_id,
                            "Headsign": element[0].trip_headsign,
                            "Scheduled Arrival Time": element[0].arrival_time,
                            "Live Arrival Time": convertToBrisbaneTime(liveArrivalTime),
                            "Live Position": liveBusPosition,
                            "Estimated Time": estimatedTime
                        };
                        objects.push(obj);

                    });
                    console.table(objects);

                    while (true) {
                        try {
                            let restart = prompt("Would you like to search again?");
                            // case insensitive
                            if (restart.toLowerCase() === "yes" || restart.toLowerCase() === "y") {                                
                                break;
                            }
                            if (restart.toLowerCase() === "no" || restart.toLowerCase() === "n") {
                                // clear the interval
                                clearInterval(timerId);
                                console.log("Thanks for using the Route tracker!");
                                return;
                            }
                        } catch (error) {
                            console.error(error.message);
                            console.error("Please enter a valid option.");
                        }
                    }
                    break;
                }
                break;
            }
            break;
        }
    }

}
[trip_updates, vehicle_positions, alerts] = await initializeData(TRIP_UPDATES_URL, VEHICLE_POSITIONS_URL, "all");
firstStart = false;
main();