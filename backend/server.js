const express = require("express");
const app = express();
const cors = require("cors");
const mysql = require("mysql");
const multer = require("multer");
const axios = require('axios');
const QRCode = require('qrcode');
const paypal = require("paypal-rest-sdk");

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST'],       
    credentials: true                
}));
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "27.Dec.2004",
    database: "movie_ticket_book"
});

//===================================Connect to MySQL database================================================================
db.connect((err) => {
    if (err) {
        console.error("Error connecting to MySQL:", err);
        return;
    }
    console.log("Connected to MySQL database");
});

// ==================================Signup route=============================================================================
app.post("/signup", (req, res) => {
    console.log("request recieved")
    const sql="INSERT INTO user(`emailid`,`password`,`name`,`gender`,`dob`,`address`,`city`,`state`) VALUES(?,?,?,?,?,?,?,?)";
    const values=[req.body.email,req.body.password,req.body.name,req.body.gender,req.body.dob,req.body.address,req.body.city,req.body.state];
    console.log(req.body.email);
    db.query(sql,values,(err,result)=>{
        if(err){
            console.error('error inserting data:',err);
            return res.status(500).json({ message: 'Error inserting data', error: err.message });

        }
        console.log("Data inserted successfully", result); 
        return res.status(201).json({ message: 'Data inserted successfully', result });
    })
});
app.post("/check-email", async (req, res) => {
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(200).json({ message: "Email available" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  //===========================================signin=========================================================
  app.post('/signin', (req, res) => {
    console.log("Signin request received");

    const {email,password } = req.body;
    const sql = "SELECT * FROM user WHERE emailid = ? AND password = ?";
    
    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error('Error querying data:', err);
            return res.status(500).json({ message: 'Error querying data', error: err.message });
        }
        if (result.length > 0) {
            // User found, return user details or success message
            return res.status(200).json({ message: 'Signin successful', user: result[0] });
        } else {
            // No user found
            return res.status(401).json({ message: 'Invalid email or password' });
        }
    });

});
//======================================================Addmovie==================================================================
app.post("/addmovie",(req, res) => {
    console.log("Received movie data:", req.body);

    const sql = "INSERT INTO movie_info(`title`, `genre`, `descript`, `release_date`, `poster_url`, `director`, `musicdirector`, `actor_name1`,`actor_name2`, `actor_name3`, `actor_name4`, `actor_img1`, `actor_img2`, `actor_img3`, `actor_img4`,`language`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)";

    const values = [
        req.body.title,
        req.body.genre,
        req.body.description,
        req.body.releasedate,
        req.body.poster,
        req.body.director,
        req.body.musicdirector,
        req.body.actor1,
        req.body.actor2,
        req.body.actor3,
        req.body.actor4,
        req.body.actor1_img,
        req.body.actor2_img, 
        req.body.actor3_img, 
        req.body.actor4_img,
        req.body.language
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error inserting movie data:", err);
            return res.status(500).json({ message: "Error inserting movie data", error: err.message });
        }
        console.log("Movie added successfully:", result);
        return res.status(201).json({ message: "Movie added successfully", result });
    });
});
//=====================================Main==========================================================================
app.get('/', (req, res) => {
  const query = 'SELECT * FROM movie_info'; // Adjust table name and columns as per your DB structure
  db.query(query, (err, results) => {
      if (err) {
          console.error('Database query error:', err); // Log error details
          res.status(500).send('Database error');
      } else {
          res.json(results);
      }
  });
});
//===================================Payment========================================================================
const stripe = require('stripe')('sk_test_51QNQwFAhsz3I07t5hZJeVWGsLZQfJevGWmQK8QyLRJs7MYqfnl8P1rHSgY10Tkj74ahbbpPxNYl7WUDISfMmmhz400wwW8OSze'); // Replace with your actual secret key

app.post('/payment', async (req, res) => {
    const { amount, email } = req.body;
  
    // Check for missing or invalid fields
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount. It must be a positive number." });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address." });
    }
  
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount, // In smallest currency unit (e.g., paise)
        currency: "inr",
        receipt_email: email, // To send a receipt to the user's email
      });
  
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: "Payment failed" });
    }
  });

//================================================Payment_status====================================================================
app.post("/payment_status", (req, res) => {
    console.log("Request received to store payment status");
    console.log("Request body:", req.body);

    const { email, seats, date, time, movieName, payment_status, amount, payment_type, theatre, location } = req.body;

    // Check if all required fields are present
    if (!email || !seats || !date || !time || !movieName || !payment_status || !amount || !payment_type || !theatre || !location) {
        console.error("Missing fields in request:", req.body);
        return res.status(400).json({ message: "All fields are required.", missingFields: req.body });
    }

    // Format seats as a comma-separated string if it's an array
    const formattedSeats = Array.isArray(seats) ? seats.join(",") : seats;

    const sql = `INSERT INTO payment_status (emailid, ticket_seats, date, time, title, payment_status, amount, payment_type, theatre, location) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [email, formattedSeats, date, time, movieName, payment_status, amount, payment_type, theatre, location];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            return res.status(500).json({ message: "Error inserting data", error: err.message });
        }
        console.log("Payment data inserted successfully", result);
        return res.status(201).json({ message: "Payment data inserted successfully", result });
    });
});


  //==================================================book-ticket====================================================================
  app.get("/bookticket", (req, res) => {
    const { movie, date, time } = req.query; // Ensure these parameters are passed
    const sql = `
        SELECT ticket_seats 
        FROM payment_status 
        WHERE title = ? AND date = ? AND time = ? AND payment_status = 'Success'
    `;

    db.query(sql, [movie, date, time], (err, results) => {
        console.log(date);
        if (err) {
            console.error("Error executing SQL query:", err);
            res.status(500).json({ error: "An error occurred while fetching blocked seats." });
        } else {
            // Assuming ticket_seats is a string like "A1,A2,A3", split it into an array
            const bookedSeats = results.flatMap(row => row.ticket_seats ? row.ticket_seats.split(",") : []);
            
            console.log("Booked seats:", bookedSeats);
            res.status(200).json({ bookedSeats });
        }
    });
}); 
//=====================================profile=======================================================================
app.get("/profile", (req, res) => {
    const email = req.query.email; // Fetch email from query params
  
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
  
    const query = `SELECT * FROM user WHERE emailid = ?`;
  
    db.query(query, [email], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Server error" });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Send the user data as response
      res.json(results[0]);
    });
  });
//===========================================delete movie=====================================================================
app.delete("/movies/:id", (req, res) => {
    const movieId = req.params.id;
    console.log("Hello",movieId);
    const query = "DELETE FROM movie_info WHERE movie_id = ?";
    db.query(query, [movieId], (err, result) => {
        if (err) {
            console.error("Error deleting movie:", err);
            return res.status(500).json({ message: "Error deleting movie" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Movie not found" });
        }

        res.status(200).json({ message: "Movie deleted successfully" });
    });
});

// =======================================display movielist========================================================
app.get('/movielist', (req, res) => {
    const query = 'SELECT * FROM movie_info'; // Adjust table name and columns as per your DB structure
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err); // Log error details
            res.status(500).send('Database error');
        } else {
            res.json(results);
        }
    });
  });
  //==========================================movie_data================================================================
  app.get('/movie_data/:id', (req, res) => {
    const movieId = req.params.movieId;
  
    const query = 'SELECT * FROM movie_info WHERE movie_id = ?';
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error fetching movie data:', err);
        return res.status(500).send('Error fetching movie data');
      }
      if (result.length > 0) {
        res.json(result[0]); // Assuming the result contains the movie data
      } else {
        res.status(404).send('Movie not found');
      }
    });
  });
  //==================================================update movie==================================================================
  app.put("/updatemovie/:id", (req, res) => {
    const { id } = req.params; // Get the movie ID
    const updates = req.body; // Fields to be updated

    if (Object.keys(updates).length === 0) {
        return res.status(400).send("No data provided for update.");
    }

    // Filter out fields with empty, null, or undefined values
    const filteredUpdates = {};
    for (let key in updates) {
        if (updates[key] !== "" && updates[key] !== null && updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
        }
    }

    if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).send("No valid data provided for update.");
    }

    const fields = [];
    const values = [];
    for (let key in filteredUpdates) {
        fields.push(`${key} = ?`);
        values.push(filteredUpdates[key]);
    }
    const sql = `UPDATE movie_info SET ${fields.join(", ")} WHERE movie_id = ?`;
    values.push(id); // Add the ID at the end for the WHERE clause

    // Perform the database update
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error updating movie:", err);
            return res.status(500).send("Error updating movie.");
        }
        if (result.affectedRows === 0) {
            return res.status(404).send("Movie not found.");
        }
        res.send("Movie updated successfully!");
    });
});
//=============================view_payment==============================================
app.get('/api/payment-status', (req, res) => {
  const { time, city, theatre, paymentStatus } = req.query;

  // Start the query
  let query = 'SELECT * FROM payment_status WHERE 1=1';

  // Apply filters dynamically
  if (time) {
    query += ` AND payment_time LIKE '%${time}%'`;
  }
  if (city) {
    query += ` AND city LIKE '%${city}%'`;
  }
  if (theatre) {
    query += ` AND theatre LIKE '%${theatre}%'`;
  }
  if (paymentStatus) {
    query += ` AND payment_status LIKE '%${paymentStatus}%'`;
  }

  // Execute the query
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    res.json(results); // Send the data back to the frontend
  });
});
//===========================================GET Total Movies Count=====================================================================
app.get("/api/movies/count", (req, res) => {
  const sql = "SELECT COUNT(*) AS total_movies FROM movie_info"; // SQL query to get the total count of movies
  console.log("Executing SQL to fetch total movies count:", sql);  // Log the SQL query
  db.query(sql, (err, result) => {
      if (err) {
          console.error("Error fetching movie count:", err);
          return res.status(500).json({ message: "Error fetching movie count", error: err.message });
      }
      console.log("Total movies count result:", result);  // Log the result of the query
      return res.status(200).json({ totalMovies: result[0].total_movies });
  });
});



//===========================================GET Total Users Count=====================================================================
app.get("/api/users/count", (req, res) => {
  const sql = "SELECT COUNT(*) AS total_users FROM user"; // SQL query to get the total count of users
  console.log("Executing SQL to fetch total users count:", sql);  // Log the SQL query
  db.query(sql, (err, result) => {
      if (err) {
          console.error("Error fetching user count:", err);
          return res.status(500).json({ message: "Error fetching user count", error: err.message });
      }
      console.log("Total users count result:", result);  // Log the result of the query
      return res.status(200).json({ totalUsers: result[0].total_users });
  });
});





//===================port connection======================================================================================
const PORT =3001; // or any other available port
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
