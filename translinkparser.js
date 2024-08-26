import fetch from 'node-fetch';
// import fs promises from 'fs/promises';
import fs, {promises as fsPromises} from 'fs';
import {parse} from 'csv-parse';
import { csvDF } from './dataframe.js';

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

// get the data from the static-data folder
// const agency = await readFile('./static-data/agency.txt');
// const calendar_dates = await readFile('./static-data/calendar_dates.txt');
// const calendar = await readFile('./static-data/calendar.txt');
// const feed_info = await readFile('./static-data/feed_info.txt');
// const temp = await readFile('./static-data/routes.txt');
// const routes = temp.filter(route => route.route_type === "3"); // get only bus routes
// //console.info("Bus Routes:", routes);
// const shapes = readFile('./static-data/shapes.txt');
// const stop_times = await readFile('./static-data/stop_times.txt');
// const stops = await readFile('./static-data/stops.txt');
// const trips = await readFile('./static-data/trips.txt');



const joinedDf = await csvDF().loadCSV('./static-data/routes.txt');
const tripsDF = await csvDF().loadCSV('./static-data/trips.txt');
joinedDf.filter('route_type', '3');

const stopTimesDF = await csvDF().loadCSV('./static-data/stop_times.txt');

const stopsDF = await csvDF().loadCSV('./static-data/stops.txt');

const calendarDF = await csvDF().loadCSV('./static-data/calendar.txt');
console.info("First Calendar DF length:", calendarDF.getData().length);

const calendarDatesDF = await csvDF().loadCSV('./static-data/calendar_dates.txt');
//joinedDf.join(calendarDatesDF, 'service_id');
 


/**
 * This function will save a JSON cache file with the specified filename & data.
 * @param {string} filenameAppend - The string to append to the JSON filename.
 * @param {string} data - The string containing JSON data to save.
 */
async function saveCache(filenameAppend, data) {
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
async function readCache(filenameAppend) {
    try {
        filenameAppend = CACHE_FOLDER + filenameAppend + ".json";
        const data = await fsPromises.readFile(filenameAppend, 'utf8');
        console.log(messageReadCache(filenameAppend));
        return data;
    } catch(error) {
        console.log("The error is: ", error);
    }
    return null;
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

// Initialize data variables for trip_updates, vehicle_positions, and alerts
let allData = await readCache("all");
let trip_updates = [];
let vehicle_positions = [];
let alerts = [];

if (allData) {
    try {
        allData = JSON.parse(allData);  // Parse the JSON string into an object
        trip_updates = allData.trip_updates || [];
        vehicle_positions = allData.vehicle_positions || [];
        alerts = allData.alerts || [];

        //console.info("trip_updates:", JSON.stringify(trip_updates));
    } catch (error) {
        console.error("Error parsing JSON from cache file:", error.message);
    }
} else {// If cache files do not exist, fetch data from API

    // get the data from the API
    trip_updates = await fetch_data(TRIP_UPDATES_URL);
    vehicle_positions = await fetch_data(VEHICLE_POSITIONS_URL);
    alerts = await fetch_data(ALERTS_URL);

    allData = {
        "trip_updates": trip_updates,
        "vehicle_positions": vehicle_positions,
        "alerts": alerts
    }
    // Store JSON objects into cache files
    await saveCache("all", allData);

    //console.log(dataAll);
    //console.log(dataTop);

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
    let inboundStopIds = stopTimesDF.getData().filter(stop => inboundTripIds.includes(stop.trip_id)).map(stop => stop.stop_id);
    let outboundStopIds = outboundTrip.length !== 0 ? stopTimesDF.getData().filter(stop => outboundTrip.map(trip => trip.trip_id).includes(stop.trip_id)).map(stop => stop.stop_id) : [];
    console.info("Inbound Stop IDs length:", inboundStopIds.length);
    console.info("Outbound Stop IDs length:", outboundStopIds.length);

    // Sort the stop_ids by stop_sequence and get the stop_names
    let inboundStopNames = stopsDF.getData().filter(stop => inboundStopIds.includes(stop.stop_id)).sort((a, b) => a.stop_sequence - b.stop_sequence).map(stop => stop.stop_name);
    let outboundStopNames = outboundTrip.length !== 0 ? stopsDF.getData().filter(stop => outboundStopIds.includes(stop.stop_id)).sort((a, b) => a.stop_sequence - b.stop_sequence).map(stop => stop.stop_name) : [];

    let all_stops;
    // If it's a loop route (outbound_trips is []), the last stop should be the same as the first stop, but add it explicitly
    if (outboundStopNames.length !== 0) {
        all_stops = [...new Set([...inboundStopNames]), ...new Set([...outboundStopNames])];
    } else {
        all_stops = [...new Set([...inboundStopNames])];
        all_stops.push(all_stops[0]); // Add the starting stop at the end to complete the loop
    }
    //console.info("All Stops:", all_stops);
    return all_stops;
}


function print_stops(stopsList) {
    for (let i = 0; i < stopsList.length; i++) {
        console.log(i + 1 + ". " + stopsList[i]);
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
function toDate(stringDate) {
    // from YYYYMMDD to Date object
    let year = stringDate.substring(0, 4);
    let month = stringDate.substring(4, 6);
    let day = stringDate.substring(6, 8);
    //console.log(year, month, day);
    return new Date(year + "-" + month + "-" + day);
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
            routeShortName = "66" // await prompt("What Bus Route would you like to take?"); // 
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
        joinedDf.filter('route_id', route_id);
        console.info("Joined DF length:", joinedDf.getData().length);
        stopsList = get_stops(route_id);
        print_stops(stopsList);
        // make stopsList as tuple with index and stop name
        stopsTuple = stopsList.map((stop, index) => [index + 1, stop]);
        while (true) {
            let [start_stop, end_stop] = [];
            try {
                let startEnd = "1 - 2"; // await prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop" "14 - 20"; // 
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
                    dateStr = "2024-08-19"//await prompt("What date will you take the route?"); // 
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
                        time = "06:57"//await prompt("What time will you leave?"); // 
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

                    // get specific date and time that the user wants to take the bus
                    const approximate_time = new Date(date);
                    approximate_time.setHours(hour + BRISBANE_TIMEZONE, minute, 0, 0);
                    console.info("Approximate Time:", approximate_time);

                    // get the day of the week
                    const dayOfWeek = daysOfWeek[approximate_time.getDay()];
                    console.info("Day of the week:", dayOfWeek);

                    // print to verify the user input is correct
                    console.info("route_id:", route_id, "date:", date, "start_stop:", start_stop, "end_stop:", end_stop, "time:", time);
                    
                    if (Number(start_stop) - Math.floor(stopsList.length / 2) > 0) {  
                        tripsDF.filter('direction_id', '1');
                    } else {
                        tripsDF.filter('direction_id', '0');
                    }
                    // joinedDf.join(tripsDF, 'route_id');
                    // console.info("Joined DF length:", joinedDf.getData().length);

                    // let service_ids = joinedDf.getData().map(route => route.service_id);
                    // service_ids = [...new Set(service_ids)];
                    // console.info("Service IDs length:", service_ids.length);
                    // let trip_ids = tripsDF.getData().map(trip => trip.trip_id);

                    // let filteredStopTimes = stopTimesDF.getData().filter(stop => {
                    //     return stop.trip_id === trip_ids[0] && stop.stop_id === stopsList[start_stop - 1];
                    // });
                    

                    stopTimesDF.join(stopsDF, 'stop_id');
                    console.info("Stop Times DF length:", stopTimesDF.getData().length);
                    
                    console.info("Calendar DF length:", calendarDF.getData().length);
                    console.info("Calendar Dates DF length:", calendarDatesDF.getData().length);
                    calendarDF.join(calendarDatesDF, 'service_id'); 
                    console.info("after, Calendar DF length:", calendarDF.getData().length);

                    calendarDF.filterBy(cal => {
                        let startDate = toDate(cal.start_date);
                        let endDate = toDate(cal.end_date);
                        return cal[dayOfWeek] === "1"
                            && date >= startDate
                            && date <= endDate;
                    }); 
                    console.info("Filtered Calendar DF length:", calendarDF.getData().length);                   

                    joinedDf.join(stopTimesDF, 'trip_id');
                    joinedDf.join(calendarDF, 'service_id');
                    console.info("Joined DF:", joinedDf.getData());
                    
                    while (true) {
                        try {
                            let restart = prompt("Would you like to search again?");
                            // case insensitive
                            if (restart.toLowerCase() === "yes" || restart.toLowerCase() === "y") {
                                break;
                            }
                            if (restart.toLowerCase() === "no" || restart.toLowerCase() === "n") {
                                console.log("Thanks for using the Route tracker!");
                                return;
                            }
                        } catch (error) {
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

main();