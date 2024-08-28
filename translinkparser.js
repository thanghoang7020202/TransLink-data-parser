import fetch from 'node-fetch';
// import fs promises from 'fs/promises';
import fs, {promises as fsPromises} from 'fs';
import {parse} from 'csv-parse';
import { csvDF } from './dataframe.js';
import { join } from 'path';

// Read the CSV file and parse it to JSON object
import promptsync from 'prompt-sync'; // prompt-sync module
const prompt = promptsync({sigint: true} );  

const TRIP_UPDATES_URL = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";
const VEHICLE_POSITIONS_URL = "http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json";
const ALERTS_URL = "http://127.0.0.1:5343/gtfs/seq/alerts.json";
const CACHE_FOLDER = "./cached-data/";
const messageSaveCache = (filenameAppend) => `Saved a JSON cache file called "${filenameAppend}".`;
const messageReadCache = (filenameAppend) => `Read a JSON cache file called "${filenameAppend}".`;
const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const BRISBANE_TIMEZONE = 10; // Brisbane timezone is UTC+10
const TEN_MINUTES = 600000; // 10 minutes in milliseconds

let isLoopRoute = false;
let trip_updates = [];
let vehicle_positions = [];
let alerts = [];

let joinedDf = await csvDF().loadCSV('./static-data/routes.txt');
let tripsDF = await csvDF().loadCSV('./static-data/trips.txt');
joinedDf.filter('route_type', '3');

let stopTimesDF = await csvDF().loadCSV('./static-data/stop_times.txt');

let stopsDF = await csvDF().loadCSV('./static-data/stops.txt');

let calendarDF = await csvDF().loadCSV('./static-data/calendar.txt');

let calendarDatesDF = await csvDF().loadCSV('./static-data/calendar_dates.txt');
//joinedDf.join(calendarDatesDF, 'service_id');
 


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
 * @returns {string} The string containing JSON data from the cache file.
 */
async function read_cache(filenameAppend) {
    try {
        filenameAppend = CACHE_FOLDER + filenameAppend + ".json";
        const data = await fsPromises.readFile(filenameAppend, 'utf8');
        console.log(messageReadCache(filenameAppend));
        return data;
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
            fs.unlinkSync(path.join(cacheDir, file));
            console.info("Deleted file:", file);
        }
        console.info("Cache directory cleared.");
    } catch (error) {
        console.error("Cache prune error:", error);
    }
}


/**
 * Fetch data from the API
 * @param {string} api_url 
 * @returns {Object} JSON object from the API (Promise)
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

async function initializeData(tripUpdatesUrl, vehiclePositionsUrl, alertsUrl, cacheKey = "all") {
    let trip_updates = [];
    let vehicle_positions = [];
    let alerts = [];

    let allData = await read_cache(cacheKey);

    if (allData) {
        try {
            allData = JSON.parse(allData); // Parse the JSON string into an object
            trip_updates = allData.trip_updates || [];
            vehicle_positions = allData.vehicle_positions || [];
            alerts = allData.alerts || [];
        } catch (error) {
            console.error("Error parsing JSON from cache file:", error.message);
        }
    } else {
        // If cache files do not exist, fetch data from the API
        trip_updates = await fetch_data(tripUpdatesUrl);
        vehicle_positions = await fetch_data(vehiclePositionsUrl);
        alerts = await fetch_data(alertsUrl);

        allData = {
            trip_updates,
            vehicle_positions,
            alerts
        };

        // Store JSON objects into cache files
        await save_cache(cacheKey, allData);
    }

    return [ trip_updates, vehicle_positions, alerts ];
}


/**
 * Get all stops of a route
 * Method: route_short_name -> route_id -> trip_id -> (list of) stop_id -> (list of) stop_name
 * Handle loop routes or inbound-outbound routes
 * @param {string} route_short_name
 * @returns {Array} all_stops list of stops
 */
function get_stops(route_id) {
    let stopsList = []; // list of stop_name strings
    
    let inboundTrip = tripsDF.extract('route_id', route_id).filter(trip => trip.direction_id === "0");
    let outboundTrip = tripsDF.extract('route_id', route_id).filter(trip => trip.direction_id === "1");
    console.info("Inbound Trip length:", inboundTrip.length);
    console.info("Outbound Trip length:", outboundTrip.length);

    const inboundTripIds = inboundTrip.map(trip => trip.trip_id);

    // get all stop_ids for inbound trips
    let inboundStopIds = stopTimesDF.extractBy(stop => inboundTripIds.includes(stop.trip_id)).map(stop => stop.stop_id);
    let outboundStopIds = outboundTrip.length !== 0 ? stopTimesDF.extractBy(stop => outboundTrip.map(trip => trip.trip_id).includes(stop.trip_id)).map(stop => stop.stop_id) : [];
    console.info("Inbound Stop IDs length:", inboundStopIds.length);
    console.info("Outbound Stop IDs length:", outboundStopIds.length);

    // Sort the stop_ids by stop_sequence and get the stop_names
    let inboundStopNames = stopsDF.extractBy(stop => inboundStopIds.includes(stop.stop_id)).sort((a, b) => a.stop_sequence - b.stop_sequence).map(stop => [stop.stop_id, stop.stop_name]);
    let outboundStopNames = outboundTrip.length !== 0 ? stopsDF.extractBy(stop => outboundStopIds.includes(stop.stop_id)).sort((a, b) => a.stop_sequence - b.stop_sequence).map(stop => [stop.stop_id, stop.stop_name]) : [];

    let all_stops;
    // If it's a loop route (outbound_trips is []), the last stop should be the same as the first stop, but add it explicitly
    if (outboundStopNames.length !== 0) {
        all_stops = [...new Set([...inboundStopNames]), ...new Set([...outboundStopNames])];
    } else {
        isLoopRoute = true;
        all_stops = [...new Set([...inboundStopNames])];
        all_stops.push(all_stops[0]); // Add the starting stop at the end to complete the loop
    }
    //console.info("All Stops:", all_stops);
    return all_stops;
}


function print_stops(stopsList) {
    for (let i = 0; i < stopsList.length; i++) {
        console.log(i + 1 + ". " + stopsList[i][1]);
    }
}

/**
 * Convert time string to Date object
 * @param {string} time
 * @returns {number} time in milliseconds
 */
function toTime(time) {
    let [hour, minute, second] = time.split(":").map(Number);
    let date = new Date();
    date.setHours(hour, minute, second, 0);
    return date.getTime();
}

/**
 * Convert string date to Date object in the format YYYYMMDD
 * @param {string} stringDate 
 * @returns {Date} Date object
 */
function to_date(stringDate) {
    // from YYYYMMDD to Date object
    let year = stringDate.substring(0, 4);
    let month = stringDate.substring(4, 6);
    let day = stringDate.substring(6, 8);
    //console.log(year, month, day);
    return new Date(year + "-" + month + "-" + day);
}
function find_trips(DF, time, start_stop) {
    const timeInMinutes = time.split(':').reduce((h, m) => h * 60 + +m);

    const tripList = DF.extract(({ stop_name, arrival_time }) => {
        if (stop_name.toLowerCase() !== start_stop.toLowerCase()) return false;

        const arrivalInMinutes = arrival_time.split(':').reduce((h, m) => h * 60 + +m);

        const timeDifference = arrivalInMinutes - timeInMinutes;
        return timeDifference >= 0 && timeDifference <= 10;
    });

    return tripList;
}

/**
 * Calculate the time difference between two times in HH:MM:SS format
 * @param {string} startTime 
 * @param {string} endTime 
 */
function time_differ(startTime, endTime) {
    const toSeconds = time => time.split(':').reduce((acc, time) => 60 * acc + +time, 0);    

    const differenceInSeconds = toSeconds(endTime) - toSeconds(startTime);

    const hours = Math.floor(differenceInSeconds / 3600);
    const minutes = Math.floor((differenceInSeconds % 3600) / 60);
    const seconds = differenceInSeconds % 60;

    return [hours, minutes, seconds].map(unit => String(unit).padStart(2, '0')).join(':');
}


// for testing purposes only
function convertMillisecondsToTime(milliseconds) {
    // Create a Date object from the milliseconds
    const date = new Date(milliseconds);

    // Extract hours, minutes, and seconds from the Date object
    const hours = date.getUTCHours(); // getUTCHours() is used to get the hours in the UTC time zone
    const minutes = date.getUTCMinutes(); // getUTCMinutes() is used to get the minutes in the UTC time zone
    const seconds = date.getUTCSeconds(); // getUTCSeconds() is used to get the seconds in the UTC time zone

    // Format the time as HH:mm:ss
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return formattedTime;
}


// @ts-check
async function main() {
    console.log("Welcome to the South East Queensland Route Planner!");
    // create a variable to store the combination to different txt files in the static-data folder

    // prompting IU
    while (true) {
        let routeShortName = "";
        let route_id = "";
        let stopsTuple = [];
        let dateStr = "";
        let date = "";
        let time = "";
        let hour = "", minute = "";
        let stopsList = [];

        try {
            routeShortName = "40" // await prompt("What Bus Route would you like to take?"); // 
            // check if the bus route isvalid and exists in the routes.txt file
            //console.info("Expected type: " + .routetypeof routes_short_name);
            //console.log(joinedDf.getData().length);
            route_id = joinedDf.find('route_short_name', routeShortName).route_id;
        
            if (!route_id) {
                throw new Error("Invalid Bus Route");
            }
            console.info("Bus Route: " + routeShortName + " of type " + typeof routeShortName + " with route_id: " + route_id);
            
        } catch (error) {
            console.error(error.message);
            console.error("Please enter a valid bus route.");
            continue;
        }
        // print all stops for the bus route from route_url
        console.info("Joined DF length (before) - with route_id:", joinedDf.getData().length);
        joinedDf.filter('route_id', route_id); 
        console.info("Joined DF length (after):", joinedDf.getData().length);
        stopsList = get_stops(route_id);
        print_stops(stopsList);
        // make stopsList as tuple with index and stop name
        stopsTuple = stopsList.map((stop, index) => [index + 1, stop]);
        while (true) {
            let [start_stop, end_stop] = [];
            try {
                let startEnd =  await prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop" "14 - 20"; // "2 - 7"; //
                [start_stop, end_stop] = startEnd.split("-").map(stop => stop.trim()).map(Number);
                //console.info("Start Stop:", start_stop);
                //console.info("End Stop:", end_stop);
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
                    console.info("Date:", date);
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
                    const dayOfWeek = daysOfWeek[date.getDay()];
                    console.info("Day of the week:", dayOfWeek);

                    // print to verify the user input is correct
                    console.info("route_id:", route_id, "date:", date, "start_stop:", start_stop, "end_stop:", end_stop, "time:", time);
                    
                    console.info("tripsDF length (before) - with direction id", tripsDF.getData().length);
                    if (!isLoopRoute && (start_stop > Math.floor(stopsList.length / 2))) {
                            tripsDF.filter('direction_id', '1');
                        } else {
                            tripsDF.filter('direction_id', '0');
                        }
                    console.info("tripsDF length (after):", tripsDF.getData().length);

                    console.info("Calendar DF DF length (before):", stopTimesDF.getData().length);
                    calendarDF.join(calendarDatesDF, 'service_id'); // calendarDF + calendarDatesDF
                    console.info("Calendar DF length (after):", calendarDF.getData().length);
                    
                    console.info("Calendar Dates DF length (before):", calendarDatesDF.getData().length);
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
                    console.info("Filtered Calendar DF length (after):", calendarDF.getData().length);
                    
                    
                    console.info("Stop Times DF length (before):", stopTimesDF.getData().length);
                    stopsDF.filterBy(stop => stop.stop_id === stopsList[start_stop - 1][0] || stop.stop_id === stopsList[end_stop - 1][0]);
                    console.info("Filtered Stops DF length (after):", stopsDF.getData().length);

                    joinedDf.join(tripsDF, 'route_id'); // routeDf + tripsDF
                    console.info("Joined DF length (route_id):", joinedDf.getData().length);

                    joinedDf.join(stopTimesDF, 'trip_id'); // routeDf + tripsDF + stopTimesDF
                    console.info("Filtered joined DF length (trip_id):", joinedDf.getData().length);
                    
                    joinedDf.join(stopsDF, 'stop_id'); // routeDf + tripsDF + stopTimesDF + stopsDF
                    console.info("Filtered joined DF length (stop_id):", joinedDf.getData().length);
                    //console.info("Joined DF:", joinedDf.getData());

                    joinedDf.join(calendarDF, 'service_id'); // routeDf + tripsDF + stopTimesDF + stopsDF + calendarDF + calendarDatesDF
                    console.info("Filtered joined DF length (service_id):", joinedDf.getData().length);
                    
                    console.info("joinedDf length (before) - with start_stop:", joinedDf.getData().length);
                    let startTimes = joinedDf.extractBy(stop => {
                        // if the stop is the first stop, use departure_time instead of arrival_time
                        let arrival_time = start_stop === 1 ? stop.departure_time : stop.arrival_time;
                        //console.info("Arrival Time:", arrival_time);
                        const arrivalList = arrival_time.split(':').map(Number)
                        const arrivalInMinutes = arrivalList[0] * 60 + arrivalList[1];
                        //console.info("Arrival Time in Minutes:", arrivalInMinutes, "Time in Minutes:", minutes);
                        const timeDifference = arrivalInMinutes - minutes;
                        return timeDifference >= 0 && timeDifference <= 10;
                    });
                    console.info("Filtered Stop Times DF", startTimes)

                    //convert startTimes to a list of objects

                    let objects = [];
                    startTimes.forEach(element => {
                        let obj = {};
                        let estimatedTime;
                        // run through each stop in stopList until the end stop such that the arrive time of that stop of following stop is > previous stop in joinedDf.
                        // if the end stop is reached, calculate the time difference between the arrival time of the end stop and the start stop
                        // if the end stop is not reached, continue to the next stop
                        let stop = element.stop_name;
                        let arrival_time = element.arrival_time;
                        for (let i = start_stop; i < end_stop; i++) {
                            let nextStop = stopsList[i][1];
                            let nextStopTimes = joinedDf.extractBy(stop => stop.stop_name === nextStop);
                            for (let nextStopTime of nextStopTimes) {
                                if (toTime(nextStopTime.arrival_time) > toTime(arrival_time)) {
                                    stop = nextStop;
                                    arrival_time = nextStopTime.arrival_time;
                                }
                            }
                        }
                        console.info("Stop:", stop, "Start Stop Time:", time.concat(":00") , ",and End Stop Time:", arrival_time);
                        estimatedTime = time_differ(time.concat(":00"), arrival_time);
                        
                        let liveTripUp = trip_updates.entity.find(trip => trip.trip_id === element.trip_id);
                        let liveArrivalTime;
                        let livePosition;

                        if (liveTripUp) {
                            const liveArrival = liveTripUp.tripUpdate.stopTimeUpdate.find(
                                stopUpdate => stopUpdate.stopId === trip.stop_id
                            );
                            if (liveArrival && liveArrival.arrival && liveArrival.arrival.time) {
                                liveArrivalTime = convertToAEST(liveArrival.arrival.time);
                            }
                        }
                    
                        const liveVePos = vehicle_positions.entity.find(entity => entity.vehicle && entity.vehicle.trip && entity.vehicle.trip.tripId === element.trip_id);
                    
                        if (liveVePos && liveVePos.vehicle.position) {
                            const { latitude, longitude } = liveVePos.vehicle.position;
                            livePosition = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                        }
                        
                        // create an object with the route short name, trip_id, route long name, service_id, headsign, scheduled arrival time, live arrival time, live position, and estimated time
                        obj = {
                            "Route Short Name": routeShortName,
                            "Trip ID": element.trip_id,
                            "Route Long Name": element.route_long_name,
                            "Service ID": element.service_id,
                            "Headsign": element.trip_headsign,
                            "Scheduled Arrival Time": element.arrival_time,
                            "Live Arrival Time": liveArrivalTime,
                            "Live Position": livePosition,
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
                                cache_prune();
                                // re-read the cache files
                                trip_updates = await fetch_data(TRIP_UPDATES_URL);
                                vehicle_positions = await fetch_data(VEHICLE_POSITIONS_URL);
                                alerts = await fetch_data(ALERTS_URL);

                                // Store JSON objects into cache files
                                let allData = {
                                    trip_updates,
                                    vehicle_positions,
                                    alerts
                                };
                                await save_cache(cacheKey, allData);
                                
                                break;
                            }
                            if (restart.toLowerCase() === "no" || restart.toLowerCase() === "n") {
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

[trip_updates, vehicle_positions, alerts] = await initializeData(TRIP_UPDATES_URL, VEHICLE_POSITIONS_URL, ALERTS_URL, "all");
main();