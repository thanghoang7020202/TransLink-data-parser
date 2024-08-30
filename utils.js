
/**
 * Convert string date to Date object in the format YYYYMMDD
 * @param {string} stringDate 
 * @returns {Date} Date object
 */
export function to_date(stringDate) {
    // from YYYYMMDD to Date object
    let year = stringDate.substring(0, 4);
    let month = stringDate.substring(4, 6);
    let day = stringDate.substring(6, 8);
    //console.log(year, month, day);
    return new Date(year + "-" + month + "-" + day);
}

/**
 * Calculate the time difference between two times in HH:MM:SS format
 * @param {string} startTime 
 * @param {string} endTime 
 */
export function time_differ(startTime, endTime) {
    const toSeconds = time => time.split(':').reduce((acc, time) => 60 * acc + +time, 0);    

    const differenceInSeconds = toSeconds(endTime) - toSeconds(startTime);

    const hours = Math.floor(differenceInSeconds / 3600);
    const minutes = Math.floor((differenceInSeconds % 3600) / 60);
    const seconds = differenceInSeconds % 60;

    return [hours, minutes, seconds].map(unit => String(unit).padStart(2, '0')).join(':');
}

/**
* Convert the time of format HH:MM:SS to minutes, ignoring the seconds
* @param {string} time 
* @returns {number} time in minutes
*/
export function to_minutes(time) {
    let l = time.split(':').map(Number);
    let a = l[0] * 60 + l[1];
    //console.info("Time in minutes:", a);
    return a;
}

/**
 * Convert the time in minutes to HH:MM:SS format
 * @param {string} unixTimestamp in seconds
 * @returns 
 */
export function convertToBrisbaneTime(unixTimestamp) {
    // Convert the Unix timestamp (in seconds) to milliseconds
    const date = new Date(unixTimestamp * 1000);

    // Format the date to Brisbane time (AEST)
    const options = {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    };

    const brisbaneTime = new Intl.DateTimeFormat('en-AU', options).format(date);

    //exclude the date and return only the time in 24-hour format
    const time = brisbaneTime.split(',')[1].trim();
    //console.log(time);
    return time;
}