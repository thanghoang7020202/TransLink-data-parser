import { csvDF } from '../dataframe';

/*
data1.csv
id,name,age
1,John,23
2,Smith,25
3,David,45

data2.csv
id,city
1,New York
2,Los Angeles
3,Chicago

dataSmaller.csv
id,gender
1,male
2,non-binary
*/
test('loadCSV', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
}, 5000); // Increase the timeout to 5 seconds


test("sortBy", async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    df1.sortBy('age');
    expect(df1.getData()[0].age).toBe("23");
    df1.sortBy('name');
    expect(df1.getData()[0].name).toBe('David');
}, 5000); // Increase the timeout to 5 seconds


test('print', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.print()).toBe(df1);
}, 5000); // Increase the timeout to 5 seconds

test('getData', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData()).toEqual([{ id: '1', name: 'John', age: '23' }, { id: '2', name: 'Smith', age: '25' }, { id: '3', name: 'David', age: '45' }]);
}, 5000); // Increase the timeout to 5 seconds


test('join', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    let df2 = await csvDF().loadCSV('__tests__/data2.csv');
    let dfS = await csvDF().loadCSV('__tests__/dataSmaller.csv');
    expect(df1.getData().length).toBe(3);
    expect(df2.getData().length).toBe(3);

    df1.join(df2, 'id');
    expect(df1.getData().length).toBe(3);
    expect(df1.getData()[0].city).toBe('New York');
    expect(df1.getData()[1].city).toBe('Los Angeles');
    expect(df1.getData()[2].city).toBe('Chicago');

    df1.join(dfS, 'id');
    expect(df1.getData().length).toBe(2);
    expect(df1.getData()[0].city).toBe('New York');
    expect(df1.getData()[1].gender).toBe('non-binary');

}, 5000); // Increase the timeout to 5 seconds

test('filter', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    df1.filter('name', 'David');
    expect(df1.getData().length).toBe(1);
    expect(df1.getData()[0].name).toBe('David');
}, 5000); // Increase the timeout to 5 seconds


test("filterBy", async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    df1.filterBy(x => x.age > 24);
    expect(df1.getData().length).toBe(2);
    expect(df1.getData()[0].age).toBe('25');
}, 5000); // Increase the timeout to 5 seconds


test('find', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    expect(df1.find('name', 'David')).toEqual({ id: '3', name: 'David', age: '45' });
}, 5000); // Increase the timeout to 5 seconds

test('findBy', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    expect(df1.findBy(x => x.age > 24)).toEqual({ id: '2', name: 'Smith', age: '25' });
});


test('extract', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    expect(df1.extract('age', '25')).toEqual([{ id: '2', name: 'Smith', age: '25' }]);
}, 5000); // Increase the timeout to 5 seconds

test('extractBy', async () => {
    // Load CSV data asynchronously
    let df1 = await csvDF().loadCSV('__tests__/data1.csv');
    expect(df1.getData().length).toBe(3);
    expect(df1.extractBy(x => x.age > 24)).toEqual([{ id: '2', name: 'Smith', age: '25' }, { id: '3', name: 'David', age: '45' }]);
}, 5000); // Increase the timeout to 5 seconds
