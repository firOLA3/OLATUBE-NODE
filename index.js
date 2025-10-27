const express = require('express');
const app = express();
const dotenv = require("dotenv")
const ejs = require('ejs');
app.set('view engine', 'ejs'); 
const mongoose = require("mongoose")
const cors = require("cors")
const path = require('path')
app.use(cors()) 


dotenv.config()
const customerRouter = require("./routes/user.route")
const apiUserRouter = require('./routes/api.user.route')
const commentRouter = require('./routes/comments.route')




app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))



const URI = process.env.MongoURI


mongoose.connect(URI)
.then(()=>{
    console.log("Connected to MongoDB");
})
.catch((err)=>{
    console.error("MongoDB connection error:", err);
})





let allCustomers = [];

app.use("/user", customerRouter)
app.use('/api/user', apiUserRouter)
app.use('/api/comments', commentRouter)


const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
