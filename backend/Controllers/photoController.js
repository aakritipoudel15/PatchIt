const router = require("express").Router();
const weights = require("../Constants/constants");
const axios = require("axios");

const photoModel = require("../Models/photo");

const {calculatePriorityScore,normalizeScore,calculateDistance} = require('../Utils/helper');

// Controller to add a photo
const addPhoto = async (req, res) => {
    try {
        const { userId, photoUrl, comment, longitude, latitude } = req.body;

        // Validate required fields
        if (!userId || !photoUrl) {
            return res.status(400).json({ error: "userId and photoUrl are required." });
        }

        // Create a new photo document
        const newPhoto = new photoModel({
            userId,
            photoUrl,
            comment: comment || "", // Optional field
            longitude: longitude || "", // Optional field
            latitude: latitude || "", // Optional field
        });

        // Save to database
        const savedPhoto = await newPhoto.save();

        // Respond with success
        res.status(201).json({
            message: "Photo added successfully.",
            photo: savedPhoto,
        });
    } catch (error) {
        console.error("Error adding photo:", error);
        res.status(500).json({
            error: "Internal server error.",
            details: error.message,
        });
    }
};

const getAllPhotos = async (req, res) => {
    try {
        const { userId } = req.query; // Optional filter by userId

        // Build query object
        const query = userId ? { userId } : {};

        // Fetch photos
        const photos = await photoModel.find(query);

        res.status(200).json({
            message: "Photos retrieved successfully.",
            photos,
        });
    } catch (error) {
        console.error("Error fetching photos:", error);
        res.status(500).json({
            error: "Internal server error.",
            details: error.message,
        });
    }
};

const getPendingReports = async(req, res) =>{
    try {
        // Fetch all reports with status "pending"
        const pendingReports = await photoModel.find({ status: "reported" });

        if (pendingReports.length === 0) {
            return res.status(404).json({
                message: "No pending reports found.",
            });
        }

        // Return the pending reports
        res.status(200).json({
            message: "Pending reports retrieved successfully.",
            reports: pendingReports,
        });
    } catch (error) {
        console.error("Error fetching pending reports:", error);
        res.status(500).json({
            error: "Internal server error.",
            details: error.message,
        });
    }
}

const getResolvedReports = async(req,res) =>{
    try {
        // Fetch all reports with status "pending"
        const pendingReports = await photoModel.find({ status: "resolved" });

        if (pendingReports.length === 0) {
            return res.status(404).json({
                message: "No resolved reports found.",
            });
        }

        // Return the pending reports
        res.status(200).json({
            message: "Resolved reports retrieved successfully.",
            reports: pendingReports,
        });
    } catch (error) {
        console.error("Error fetching pending reports:", error);
        res.status(500).json({
            error: "Internal server error.",
            details: error.message,
        });
    }
}


const fetchOverpassData = async (query) => {
    try {
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await axios.get(url);
        return response.data.elements;
    } catch (error) {
        console.error('Overpass API error:', error.response?.data || error.message);
        throw error;
    }
};


const getPriorityScore = async (req, res) => {
    const {latitude,longitude} = req.body
    const maxRadius = 500; // meters

    console.log('Request received:', latitude, longitude);

    const queries = {
        hospital: `[out:json];(node["amenity"="hospital"](around:${maxRadius}, ${latitude}, ${longitude});
            way["amenity"="hospital"](around:${maxRadius}, ${latitude}, ${longitude});
            relation["amenity"="hospital"](around:${maxRadius}, ${latitude}, ${longitude});
        );out center;`,

        highway: `[out:json];way["highway"](around:${maxRadius}, ${latitude}, ${longitude});out geom;`,

        school: `[out:json];(
            node["amenity"="school"](around:${maxRadius}, ${latitude}, ${longitude});
            way["amenity"="school"](around:${maxRadius}, ${latitude}, ${longitude});
            relation["amenity"="school"](around:${maxRadius}, ${latitude}, ${longitude});
        );out center;`,
    };
    const weights = {
        hospital: 5,
        school: 4,
        primary: 5,
        secondary: 3,
        tertiary: 1,
        residential: 2
    };

    

    try {
        const [hospitals, highways, schools] = await Promise.all([
            fetchOverpassData(queries.hospital),
            fetchOverpassData(queries.highway),
            fetchOverpassData(queries.school),
        ]);

        const features = [];
        hospitals.forEach(hospital => {
            if (hospital.center) {
                const distance = calculateDistance(latitude, longitude, hospital.center.lat, hospital.center.lon);
                features.push({
                    type: 'hospital',
                    distance
                });
            }
        });

        // Process highways
        highways.forEach(highway => {
            if (highway.center) {
                const highwayType = highway.tags.highway;
                const distance = calculateDistance(latitude, longitude, highway.center.lat, highway.center.lon);
                features.push({
                    type: highwayType,
                    distance
                });
            }
        });

        // Process schools
        schools.forEach(school => {
            if (school.center) {
                const distance = calculateDistance(latitude, longitude, school.center.lat, school.center.lon);
                features.push({
                    type: 'school',
                    distance
                });
            }
        });

        const priorityScore = calculatePriorityScore(features, weights, maxRadius);
        console.log('Priority score:', priorityScore);
        const minScore = 0;
        const maxScore = 50;
        const normalizedScore = normalizeScore(priorityScore, minScore, maxScore);

        res.json({
            normalizedScore
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch data or calculate score' });
    }


    
};


module.exports = { addPhoto , getAllPhotos, getPriorityScore, getPendingReports, getResolvedReports};
