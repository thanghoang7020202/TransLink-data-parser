import { parse } from 'csv-parse';
import fs from 'fs';

/**
 * Creates a CSV DataFrame-like utility with chainable methods to load, process, and display CSV data.
 * 
 * @returns {Object} An object with methods to load a CSV, sort data, capitalize text fields, print data, and retrieve data.
 */
export function csvDF() {
    let data = []; // Internal array to store the CSV data

    return {
        /**
         * Loads a CSV file and parses it into an array of objects.
         * Each object represents a row, with keys as column headers.
         * 
         * @param {string} filePath - The path to the CSV file.
         * @returns {Promise<Object>} A promise that resolves to the current instance for chaining.
         */
        loadCSV: function (filePath) {
            return new Promise((resolve, reject) => {
                const results = [];
                fs.createReadStream(filePath)
                    .pipe(parse({ columns: true }))
                    .on('data', (row) => results.push(row))
                    .on('end', () => {
                        data = results;
                        resolve(this); // Resolve the promise with the current instance for chaining
                    })
                    .on('error', (err) => reject(err)); // Reject the promise in case of an error
            });
        },

        /**
         * Sorts the loaded data based on a specific field.
         * If the field contains numeric values, they are sorted numerically; otherwise, sorted lexicographically.
         * 
         * @param {string} field - The field name to sort by.
         * @returns {Object} The current instance for chaining.
         */
        sortBy: function (field) {
            data = [...data].sort((a, b) => {
                let aValue = a[field];
                let bValue = b[field];
        
                // Convert to number if the field is numeric
                if (!isNaN(aValue) && !isNaN(bValue)) {
                    aValue = Number(aValue);
                    bValue = Number(bValue);
                }
        
                if (aValue < bValue) return -1;
                if (aValue > bValue) return 1;
                return 0;
            });
            return this;
        },        

        /**
         * Capitalizes the first letter of each value in a specified field.
         * 
         * @param {string} field - The field name to capitalize.
         * @returns {Object} The current instance for chaining.
         */
        capitaliseFirstLetter: function (field) {
            data = data.map(row => {
                row[field] = row[field].charAt(0).toUpperCase() + row[field].slice(1);
                return row;
            });
            return this;
        },

        /**
         * Prints the current data to the console in a table format.
         * 
         * @returns {Object} The current instance for chaining.
         */
        print: function () {
            console.table(data);
            return this;
        },

        /**
         * Retrieves the current data.
         * 
         * @returns {Array} The current data as an array of objects.
         */
        getData: function () {
            return data;
        },

        /**
         * Joins the current data with another DataFrame based on a common field.
         * @param {Object} df dataframe to join with
         * @param {string} field field to join on
         * @returns {Object} The current instance for chaining.
         */
        join: function (df, field) {
            let joinedData = [];
            let otherData = df.getData();
            // if (otherData.length < data.length) {
            //     data.forEach(row => {
            //         let matchingRow = otherData.find(otherRow => otherRow[field] === row[field]);
            //         //console.log(matchingRow);
            //         if (matchingRow) {
            //             joinedData.push({ ...row, ...matchingRow });
            //         }
            //     });
            // } else {
            //     otherData.forEach(row => {
            //         let matchingRow = data.find(otherRow => otherRow[field] === row[field]);
            //         if (matchingRow) {
            //             joinedData.push({ ...row, ...matchingRow });
            //         }
            //     });
            // }
            // optimized version
            const [smaller, larger] = data.length < otherData.length ? [data, otherData] : [otherData, data];
            const smallerMap = new Map(smaller.map(row => [row[field], row])); // create a map of the smaller data
            joinedData = larger.map(row => ({ ...row, ...smallerMap.get(row[field]) })); // join the data

            // data = joinedData;
            return this;
        },

        /**
         * Filters the data based on a field and
         * @param {string} field field to filter on
         *
         * @param value
         * @returns
         */
        filter(field, value) {
            data = data.filter(row => row[field] === value);
            return this;
        },

        filterBy: function (condition) {
            data = data.filter(condition);
            return this;
        },

        /**
         * find value in the data
         * @param {string} field field to filter on
         * @param value
         */
        find(field, value) {
            return data.find(row => row[field] === value);
        },

        /**
         * Similar to filter but returns the data (without modifying the internal data)
         * @param {string} field the field to filter on
         * @param {string} value the value to filter on
         * @returns 
         */
        extract: function (field, value) {
            return data.filter(row => row[field] === value);
        },

        /**
         * Projects the data to a single field
         * @param {*} field 
         * @param {*} value 
         * @returns 
         */
        extractList: function (field, list) {
            return data.filter(row => list.includes(row[field]));
        },

        /**
         * Projects the data to a single field
         * @param {string} field the field to map to 
         * @returns 
         */
        project: function (field) {
            return data.map(row => row[field]);
        },

        include: function (field) {
            data = data.map(row => {
                row[field] = true;
                return row;
            });
            return this;
        },

        exclude: function (field) {
            data = data.map(row => {
                row[field] = false;
                return row;
            });
            return this;
        }
    }
}