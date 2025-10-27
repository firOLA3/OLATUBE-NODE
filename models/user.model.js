const mongoose = require("mongoose")


// In databases, a schema defines the structure/shape of your data.
// schema is like a blueprint for your database documents.
// Schema is used to...
// To enforce structure in MongoDB documents
// To validate data before saving
// To define relationships (e.g., User has many Posts)
// To add methods & middleware to database models
let customerSchema = mongoose.Schema({
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    name: {type: String},
    handle: {type: String, unique: true, sparse: true},
    profilePictureUrl: {type: String},
    email: {type: String, required: true, unique: [true,"Email has been taken, please choose another one"]},
    password: {type: String, required: true},
    subscriptions: [{
        channelId: {type: String, required: true},
        channelTitle: {type: String, required: true},
        channelThumbnail: {type: String, required: true}
    }],
    unreadNotifications: {type: Number, default: 0}
}, { timestamps: true });

// Add virtual for full name if name is not provided
customerSchema.virtual('fullName').get(function() {
    return this.name || `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("Customer", customerSchema)
