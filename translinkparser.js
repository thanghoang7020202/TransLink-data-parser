import fetch from 'node-fetch';
import fs from 'fs';
import {parse} from 'csv-parse';

// Read the CSV file and parse it to JSON object


import promptsync from 'prompt-sync' ;  // prompt-sync module
const prompt = promptsync({sigint: true} );  

const TRIP_UPDATES_URL = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";
const VEHICLE_POSITIONS_URL = "http://127.0.0.1:5343/gtfs/seq/vehicle_positions.json";
const ALERTS_URL = "http://127.0.0.1:5343/gtfs/seq/alerts.json";

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

// get the data from the API
const trip_updates = await fetch_data(TRIP_UPDATES_URL);
const vehicle_positions = await fetch_data(VEHICLE_POSITIONS_URL);
const alerts = await fetch_data(ALERTS_URL);

// get all stops names of a route (route_short_name -> route_id -> trip_id -> (list of) stop_id -> (list of) stop_name)
/**
 * Get all stops of a route
 * @param {number} route_short_name 
 * @returns {Array} list of stops
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

    // if inbound or outbound stops are empty, return one of them only
    // Return the combined inbound and outbound stops (Allow duplicates within inbound and outbound)
    return [...new Set([...inbound_stops]), ...new Set([...outbound_stops])];
}


    // Stages testings
    // route_short_name = route_short_name.toString();
    // let route = routes.find(route => route.route_short_name === route_short_name);
    // if (!route) {
    //     console.error("No matching route found.");
    //     return [];
    // }

    // let route_id = route.route_id;
    // let trip_ids = trips.filter(trip => trip.route_id === route_id).map(trip => trip.trip_id);
    
    // if (trip_ids.length === 0) {
    //     console.error("No trips found for this route.");
    //     return [];
    // }

    // let stop_ids = stop_times.filter(stop_time => trip_ids.includes(stop_time.trip_id)).map(stop_time => stop_time.stop_id);
    
    // if (stop_ids.length === 0) {
    //     console.error("No stops found for these trips.");
    //     return [];
    // }

    // let stopsList = stops.filter(stop => stop_ids.includes(stop.stop_id)).map(stop => stop.stop_name);

    // console.log("Stops List:", stopsList);
    // return stopsList;

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
            bus_route = "40"//prompt("What Bus Route would you like to take?");
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

        while (true) {
            let [start_stop, end_stop] = [];
            try {
                lstartEnd = prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop"
                [start_stop, end_stop] = startEnd.split("-").map(stop => stop.trim());
                console.info("Start Stop:", start_stop);
                console.info("End Stop:", end_stop);
                // check if the start and end stops are valid and exist in the stops.txt file
                if (!stops.some(stop => stop.stop_name === start_stop) || !stops.some(stop => stop.stop_name === end_stop)) {
                    throw new Error("Invalid Stops");
                }
            } catch (error) {
                console.error("Please follow the format and enter a valid number for the stop");
                continue;
            }
            
            while (true) {
                try {
                    let time = prompt("What date will you take the route?"); 
                    // check if the time is valid: Year, month & day in https://tc39.es/ecma262/#sec-date-time-string-format (YYYY-MM-DD)
                    if (!time.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        throw new Error("Invalid Time");
                    }
                } catch (error) {
                    console.error("Incorrect date format. Please use YYYY-MM-DD");
                    continue;
                }
                
                while (true) {
                    try {
                        let time = prompt("What time will you leave?");
                        // check if the time is valid: Hour & minutes in 24 hour time in https://tc39.es/ecma262/#sec-date-time-stringformat (HH:mm)
                        if (!time.match(/^\d{2}:\d{2}$/)) {
                            throw new Error("Invalid Time");
                        }
                    } catch (error) {
                        console.error("Incorrect time format. Please use HH:mm");
                        continue;
                    }

                    // get the route from the bus_route which arrive < 10mins from the time
                    
                    while (true) {
                        try {
                            let restart = prompt("Would you like to search again?");
                            // case insensitive
                            if (restart.toLowerCase() === "yes" || restart.toLowerCase() === "y") {
                                continue;
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
                }
            }
        }
    }

}

main();