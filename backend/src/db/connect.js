import dbconfig from './dbconfig.js'; 

dbconfig.query('SELECT * FROM users', (err, results) => {
    if (err) {
        console.error('Error executing query:', err);
        return;
    }
    console.log('Query results:', results);
});
