import fetch from 'node-fetch';
import fs from 'fs';
// import fs promises from 'fs/promises';
import { promises as fsPromises } from 'fs';
import {parse} from 'csv-parse';

// Read the CSV file and parse it to JSON object

import promptsync from 'prompt-sync' ;  // prompt-sync module
const prompt = promptsync({sigint: true} );  

const TRIP_UPDATES_URL = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";
const VEHICLE_POSITIONS_URL = "http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json";
const ALERTS_URL = "http://127.0.0.1:5343/gtfs/seq/alerts.json";
const CACHE_FOLDER = "./cached-data/";
const messageSaveCache = (filenameAppend) => `Saved a JSON cache file called "${filenameAppend}".`;
const messageReadCache = (filenameAppend) => `Read a JSON cache file called "${filenameAppend}".`;

/**
 * Read the file from the path and parse it to JSON object
 * the encoding type for the file is utf8
 * @param {string} path Path to the file 
 * @returns {Object} JSON object
 */
async function readFile(path) {
    try{
        const processFile = async (path) => {
            const records = [];
            const parser = fs
            .createReadStream(path)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }));
            for await (const record of parser) {
                // Work with each record
                records.push(record);
            }
            return records;
        };

        const records = await processFile(path);
        console.info("Got records from file:", path);
        return records;
    } catch (error) {
        console.error("Error reading file:", path, "with message:", error.message);
        return [];
    }
}

// get the data from the static-data folder
const agency = await readFile('./static-data/agency.txt');
const calendar_datas = await readFile('./static-data/calendar_dates.txt');
const calendar = await readFile('./static-data/calendar.txt');
const feed_info = await readFile('./static-data/feed_info.txt');
const temp = await readFile('./static-data/routes.txt');
const routes = temp.filter(route => route.route_type === "3"); // get only bus routes
//console.info("Bus Routes:", routes);
const shapes = readFile('./static-data/shapes.txt');
const stop_times = await readFile('./static-data/stop_times.txt');
const stops = await readFile('./static-data/stops.txt');
const trips = await readFile('./static-data/trips.txt');

/**
 * This function will save a JSON cache file with the specified filename & data.
 * @param {string} filenameAppend - The string to append to the JSON filename.
 * @param {string} data - The string containing JSON data to save.
 */
async function saveCache(filenameAppend, data) {
    // YOUR CODE HERE
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
 * @returns {string} the JSON data from the cache file.
 */
async function readCache(filenameAppend) {
    // YOUR CODE HERE
    try {
        filenameAppend = CACHE_FOLDER + filenameAppend + ".json";
        const data = await fsPromises.readFile(filenameAppend, 'utf8');
        console.log(messageReadCache(filenameAppend));
        return data;
    } catch(error) {
        console.log("The error is: ${error}");
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

        console.info("trip_updates:", JSON.stringify(trip_updates));
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
 * @param {number} route_short_name 
 * @returns {Array} all_stops list of stops
 */
function get_stops(route_short_name) {
    // Find the route_id for the given route_short_name
    let route_id = routes.find(route => route.route_short_name === route_short_name).route_id;
    
    // Filter trips by route_id
    let inbound_trips = trips.filter(trip => trip.route_id === route_id && trip.direction_id === "0");
    let outbound_trips = trips.filter(trip => trip.route_id === route_id && trip.direction_id === "1");
    //console.info("Inbound Trips:", inbound_trips);
    //console.info("Outbound Trips:", outbound_trips);

    // Get stop_ids for inbound and outbound trips
    let inbound_stop_ids = stop_times.filter(stop_time => inbound_trips.map(trip => trip.trip_id).includes(stop_time.trip_id));
    let outbound_stop_ids = stop_times.filter(stop_time => outbound_trips.map(trip => trip.trip_id).includes(stop_time.trip_id));
    //console.info("Inbound Stop IDs:", inbound_stop_ids);

    // Sort stops by stop_sequence
    inbound_stop_ids.sort((a, b) => a.stop_sequence - b.stop_sequence);
    outbound_stop_ids.sort((a, b) => a.stop_sequence - b.stop_sequence);
    //console.info("Inbound Stop IDs (Sorted):", inbound_stop_ids);

    // Get the unique stops (assuming stop names might be repeated)
    let inbound_stops = inbound_stop_ids.map(stop_time => stops.find(stop => stop.stop_id === stop_time.stop_id).stop_name);
    let outbound_stops = outbound_stop_ids.map(stop_time => stops.find(stop => stop.stop_id === stop_time.stop_id).stop_name);
    //console.info("Inbound Stops:", inbound_stops);

    // Combine inbound and outbound stops, solving route loops/inbound-outbound routes
    let all_stops = [];

    // If it's a loop route (outbound_trips is []), the last stop should be the same as the first stop, but add it explicitly
    if (outbound_trips.length != 0) {
        // Return the combined inbound and outbound stops (Allow duplicates within inbound and outbound)
        all_stops = [...new Set([...inbound_stops]), ...new Set([...outbound_stops])];
    } else {
        all_stops = [...new Set([...inbound_stops])]
        all_stops.push(all_stops[0]); // Add the starting stop at the end to complete the loop
    }

    return all_stops
}


function print_stops(stopsList) {
    for (let i = 0; i < stopsList.length; i++) {
        console.log(i + 1 + ". " + stopsList[i]);
    }
}


// UI and logic component
async function main() {
    console.log("Welcome to the South East Queensland Route Planner!");
    // create a variable to store the combination to different txt files in the static-data folder

    // prompting IU
    while (true) {
        let bus_route = "";
        try {
            bus_route = await prompt("What Bus Route would you like to take?");
            // check if the bus route isvalid and exists in the routes.txt file
            //console.info("Expected type: " + .routetypeof routes_short_name);
            let route_id = routes.filter(route => route.route_short_name === bus_route).map(route => route.route_id);
            if (route_id.length === 0) {
                throw new Error("Invalid Bus Route");
            }
            console.info("Bus Route: " + bus_route + " of type " + typeof bus_route + " with route_id: " + route_id);
            
        } catch (error) {
            console.error("Please enter a valid bus route.");
            continue;
        }
        // print all stops for the bus route from route_url
        let stopsList = get_stops(bus_route);
        print_stops(stopsList);
        // make stopsList as tuple with index and stop name
        let stopsTuple = stopsList.map((stop, index) => [index + 1, stop]);
        while (true) {
            let [start_stop, end_stop] = [];
            try {
                let startEnd = await prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop"
                [start_stop, end_stop] = startEnd.split("-").map(stop => stop.trim());
                //console.info("Start Stop:", start_stop);
                //console.info("End Stop:", end_stop);
                // check if the start and end stops are valid in stopTuple (to string)
                if (!stopsTuple.some(stop => stop[0] === parseInt(start_stop)) || !stopsTuple.some(stop => stop[0] === parseInt(end_stop))) {
                    throw new Error("Invalid Stops");
                }
                
            } catch (error) {
                //console.error(error.message);
                console.error("Please follow the format and enter a valid number for the stop");
                continue;
            }
            
            while (true) {
                try {
                    let time = await prompt("What date will you take the route?"); 
                    // check if the time is valid: Year, month & day in https://tc39.es/ecma262/#sec-date-time-string-format (YYYY-MM-DD)
                    if (!time.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        throw new Error("Invalid Time");
                    }
                    // check if the date is valid
                    let date = new Date(time);
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
                        let time = await prompt("What time will you leave?");
                        // check if the time is valid: Hour & minutes in 24 hour time in https://tc39.es/ecma262/#sec-date-time-stringformat (HH:mm)
                        if (!time.match(/^\d{2}:\d{2}$/)) {
                            throw new Error("Invalid Time");
                        }
                        // check if the time is valid
                        let [hour, minute] = time.split(":");
                        if (parseInt(hour) < 0 || parseInt(hour) > 23 || parseInt(minute) < 0 || parseInt(minute) > 59) {
                            throw new Error("Invalid Time");
                        }
                    } catch (error) {
                        console.error(error.message);
                        console.error("Incorrect time format. Please use HH:mm");
                        continue;
                    }

                    // get the route from the bus_route which arrive < 10mins from the time
                    
                    while (true) {
                        try {
                            let restart = await prompt("Would you like to search again?");
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
                            continue;
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