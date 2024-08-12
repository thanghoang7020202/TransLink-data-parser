import fetch from 'node-fetch';
import fs from 'fs';
import {parse} from 'csv-parse';
import promptsync from 'prompt-sync' ;  // prompt-sync module

const prompt = promptsync({sigint: true} );  // prompt-sync module

// const fs = require('fs');
// const path = require('path');
// const {parse} = require('csv-parse');
// const prompt = require('prompt-sync')({sigint: true} );  // prompt-sync module

//const agency = JSON.parse(fs.readFileSync('./static-data/agency.txt', 'utf8'));
//const calendar_datas = JSON.parse(fs.readFileSync('./static-data/calendar_dates.txt', 'utf8'));
//const calendar = JSON.parse(fs.readFileSync('./static-data/calendar.txt', 'utf8'));
//const feed_info = JSON.parse(fs.readFileSync('./static-data/feed_info.txt', 'utf8'));

// get bus routes only
const temp =  parse(fs.readFileSync('./static-data/routes.txt', 'utf8'), {
    columns: true, // convert each line to an object
    skip_empty_lines: true, // skip empty lines in the file
});
const routes = temp.filter(route => route.route_type === "3"); // get only bus routes
//const shapes = JSON.parse(fs.readFileSync('./static-data/shapes.txt', 'utf8'));
//const stop_times = JSON.parse(fs.readFileSync('./static-data/stop_times.txt', 'utf8'));
//const stops = JSON.parse(fs.readFileSync('./static-data/stops.txt', 'utf8'));
//const trips = JSON.parse(fs.readFileSync('./static-data/trips.txt', 'utf8'));
const api_url = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";

// function to fetch data from the API
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

// UI component
async function main() {
    console.log("Welcome to the South East Queensland Route Planner!");
    // create a variable to store the combination to different txt files in the static-data folder

    // prompting IU
    
    while (true) {
        let bus_route = "";
        try {
            bus_route = prompt("What Bus Route would you like to take?");
            // check if the bus route isvalid and exists in the routes.txt file
            //console.info("Expected type: " + .routetypeof routes_short_name);
            if (!routes.some(route => route.route_short_name === bus_route)) {
                throw new Error("Invalid Bus Route");
            }
            console.info("Bus Route: " + bus_route + " of type " + typeof bus_route);
            let a = await fetch_data(api_url);
            console.info(a);
        } catch (error) {
            console.error("Please enter a valid bus route.");
            continue;
        }
        // print all stops for the bus route from route_url

        while (true) {
            let [start_stop, end_stop] = [];
            try {
                lstartEnd = prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop"
                [start_stop, end_stop] = startEnd.split(" - ");
                
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
                
                while (true) {                    try {
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
import fetch from 'node-fetch';
import fs from 'fs';
import {parse} from 'csv-parse';
import promptsync from 'prompt-sync' ;  // prompt-sync module

const prompt = promptsync({sigint: true} );  // prompt-sync module

// const fs = require('fs');
// const path = require('path');
// const {parse} = require('csv-parse');
// const prompt = require('prompt-sync')({sigint: true} );  // prompt-sync module

//const agency = JSON.parse(fs.readFileSync('./static-data/agency.txt', 'utf8'));
//const calendar_datas = JSON.parse(fs.readFileSync('./static-data/calendar_dates.txt', 'utf8'));
//const calendar = JSON.parse(fs.readFileSync('./static-data/calendar.txt', 'utf8'));
//const feed_info = JSON.parse(fs.readFileSync('./static-data/feed_info.txt', 'utf8'));

// get bus routes only
const temp =  parse(fs.readFileSync('./static-data/routes.txt', 'utf8'), {
    columns: true, // convert each line to an object
    skip_empty_lines: true, // skip empty lines in the file
});
const routes = temp.filter(route => route.route_type === "3"); // get only bus routes
//const shapes = JSON.parse(fs.readFileSync('./static-data/shapes.txt', 'utf8'));
//const stop_times = JSON.parse(fs.readFileSync('./static-data/stop_times.txt', 'utf8'));
//const stops = JSON.parse(fs.readFileSync('./static-data/stops.txt', 'utf8'));
//const trips = JSON.parse(fs.readFileSync('./static-data/trips.txt', 'utf8'));
const api_url = "http://127.0.0.1:5343/gtfs/seq/trip_updates.json";

// function to fetch data from the API
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

// UI component
async function main() {
    console.log("Welcome to the South East Queensland Route Planner!");
    // create a variable to store the combination to different txt files in the static-data folder

    // prompting IU
    
    while (true) {
        let bus_route = "";
        try {
            bus_route = prompt("What Bus Route would you like to take?");
            // check if the bus route isvalid and exists in the routes.txt file
            //console.info("Expected type: " + .routetypeof routes_short_name);
            if (!routes.some(route => route.route_short_name === bus_route)) {
                throw new Error("Invalid Bus Route");
            }
            console.info("Bus Route: " + bus_route + " of type " + typeof bus_route);
            let a = await fetch_data(api_url);
            console.info(a);
        } catch (error) {
            console.error("Please enter a valid bus route.");
            continue;
        }
        // print all stops for the bus route from route_url

        while (true) {
            let [start_stop, end_stop] = [];
            try {
                lstartEnd = prompt("What is your start and end stop on the route?"); // format: "start_stop - end_stop"
                [start_stop, end_stop] = startEnd.split(" - ");
                
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
                
                while (true) {                    try {
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