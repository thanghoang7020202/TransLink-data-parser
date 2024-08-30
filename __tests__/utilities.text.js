import { to_minutes, time_differ, to_date, convertToBrisbaneTime } from "../utils";

/**
 * Convert the time of format HH:MM:SS to minutes, ignoring the seconds
 */
test('to_minutes', () => {
    const time = "12:34:56";
    const minutes = to_minutes(time);
    expect(minutes).toBe(754);
});

/**
 * Calculate the time difference between two times in HH:MM:SS format
 */
test('time_differ', () => {
    const time1 = "12:34:56";
    const time2 = "12:35:56";
    const differ = time_differ(time1, time2);
    expect(differ).toBe("00:01:00");
});


/**
 * Convert string date to Date object in the format YYYYMMDD
 */
test('to_date', () => {
    const date = "20210114";
    const newDate = to_date(date);
    expect(newDate).toEqual(new Date("2021-01-14"));
});

/**
 * Convert the time in minutes to 12-hour format
 */
test('convertToBrisbaneTime', () => {
    const unixTimestamp = 1610592000;
    const date = convertToBrisbaneTime(unixTimestamp);
    expect(date).toBe("12:40:00 pm");
});