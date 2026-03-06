const express = require('express');
const router = express.Router();
const Route = require('../models/route');
const RouteAttempt = require('../models/routeAttempt');
const Activity = require('../models/activity');
const User = require('../models/user');
const { authenticateToken: auth } = require('../middleware/auth');
const geolib = require('geolib');

// ========== CREATE ROUTE ==========
router.post('/', auth, async (req, res) => {
    try {
        const { 
            name,
            description, 
            coordinates,
            elevationGain,
            tags,
            estimatedTime 
        } = req.body;

        // Validate coordinates exist and minimum length
        if (!coordinates || coordinates.length < 2) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COORDINATES',
                message: 'Route must have at least 2 waypoints (start and end)'
            });
        }

        // Prevent abuse - max 100 waypoints
        if (coordinates.length > 100) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COORDINATES',
                message: 'Maximum 100 waypoints allowed'
            });
        }

        // Validate each coordinate
        for (const coord of coordinates) {
            if (!coord.latitude || !coord.longitude) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_COORDINATES',
                    message: 'Each coordinate must have latitude and longitude'
                });
            }
            if (coord.latitude < -90 || coord.latitude > 90) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_COORDINATES',
                    message: 'Latitude must be between -90 and 90'
                });
            }
            if (coord.longitude < -180 || coord.longitude > 180) {
                return res.status(400).json({
                    status: 'error',
                    code: 'INVALID_COORDINATES',
                    message: 'Longitude must be between -180 and 180'
                });
            }
        }

        // Add order to coordinates
        const coordinatesWithOrder = coordinates.map((point, index) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            order: index
        }));

        // Calculate total distance from coordinates
        let totalDistance = 0;
        for (let i = 0; i < coordinatesWithOrder.length - 1; i++) {
            const distance = geolib.getDistance(
                { latitude: coordinatesWithOrder[i].latitude, longitude: coordinatesWithOrder[i].longitude },
                { latitude: coordinatesWithOrder[i + 1].latitude, longitude: coordinatesWithOrder[i + 1].longitude }
            );
            totalDistance += distance;
        }

        // Convert meters to miles
        const distanceInMiles = totalDistance * 0.000621371;

        // Create route
        const route = new Route({
            name,
            description,
            creator: req.user.userId,
            coordinates: coordinatesWithOrder,
            distance: distanceInMiles,
            elevationGain: elevationGain || 0,
            tags: tags || [],
            estimatedTime: estimatedTime || null,
            startLocation: {
                type: 'Point',
                coordinates: [coordinatesWithOrder[0].longitude, coordinatesWithOrder[0].latitude]
            }
        });

        // Calculate difficulty
        route.calculateDifficulty();

        await route.save();

        res.status(201).json({
            message: 'Route created successfully',
            route: {
                id: route._id,
                name: route.name,
                distance: route.distance.toFixed(2) + ' miles',
                difficulty: route.difficulty,
                waypointCount: route.coordinates.length
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error creating route'
        });
    }
});

// ========== GET ALL ROUTES (Browse/Discovery) ==========
router.get('/', auth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            difficulty,
            minDistance,
            maxDistance,
            tags,
            creatorId,
            sortBy = 'popular' // popular, newest, distance
        } = req.query;

        // Build filter
        const filter = { isPublic: true };

        if (difficulty) {
            filter.difficulty = difficulty.toUpperCase();
        }

        if (minDistance || maxDistance) {
            filter.distance = {};
            if (minDistance) filter.distance.$gte = parseFloat(minDistance);
            if (maxDistance) filter.distance.$lte = parseFloat(maxDistance);
        }

        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim().toUpperCase());
            filter.tags = { $in: tagArray };
        }

        if (creatorId) {
            filter.creator = creatorId;
        }

        // Build sort
        let sort = {};
        if (sortBy === 'popular') {
            sort = { totalCompletions: -1, createdAt: -1 };
        } else if (sortBy === 'newest') {
            sort = { createdAt: -1 };
        } else if (sortBy === 'distance') {
            sort = { distance: 1 };
        }

        const skip = (page - 1) * limit;

        const routes = await Route.find(filter)
            .populate('creator', 'username')
            .sort(sort)
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Route.countDocuments(filter);

        res.json({
            routes: routes.map(route => ({
                id: route._id,
                name: route.name,
                description: route.description,
                creator: route.creator.username,
                distance: route.distance.toFixed(2) + ' miles',
                difficulty: route.difficulty,
                tags: route.tags,
                totalCompletions: route.totalCompletions,
                averageTime: route.averageTime ?`${Math.floor(route.averageTime / 60)} min` : 'No data',
                fastestTime: route.fastestCompletionTime ? `${Math.floor(route.fastestCompletionTime / 60)} min` : 'No data'
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRoutes: total
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching routes'
        });
    }
});

// ========== GET ROUTES NEAR ME ==========
router.get('/nearby', auth, async (req, res) => {
    try {
        const { latitude, longitude, radius = 10 } = req.query; // radius in miles

        if (!latitude || !longitude) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Latitude and longitude required'
            });
        }

        // Convert miles to meters for MongoDB geospatial query
        const radiusInMeters = parseFloat(radius) * 1609.34;

        const routes = await Route.find({
            isPublic: true,
            startLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: radiusInMeters
                }
            }
        })
        .populate('creator', 'username')
        .limit(20);

        res.json({
            routes: routes.map(route => ({
                id: route._id,
                name: route.name,
                distance: route.distance.toFixed(2) + ' miles',
                difficulty: route.difficulty,
                creator: route.creator.username,
                totalCompletions: route.totalCompletions
            })),
            searchRadius: `${radius} miles`,
            center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching nearby routes'
        });
    }
});

// GET POPULAR ROUTES
router.get('/popular', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const routes = await Route.find({ isPublic: true })
            .populate('creator', 'username')
            .sort({ totalCompletions: -1 })
            .limit(parseInt(limit));

        res.json({
            routes: routes.map(route => ({
                id: route._id,
                name: route.name,
                distance: route.distance.toFixed(2) + ' miles',
                difficulty: route.difficulty,
                creator: route.creator.username,
                totalCompletions: route.totalCompletions,
                averageTime: route.averageTime ? `${Math.floor(route.averageTime / 60)} min` : 'No data'
            }))
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching popular routes'
        });
    }
});

// ========== GET SINGLE ROUTE DETAILS ==========
router.get('/:id', auth, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id)
            .populate('creator', 'username');

        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }

        // Check if private and user is not creator
        if (!route.isPublic && route.creator._id.toString() !== req.user.userId) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'This route is private'
            });
        }

        res.json({
            route: {
                id: route._id,
                name: route.name,
                description: route.description,
                creator: route.creator.username,
                coordinates: route.coordinates,
                distance: route.distance.toFixed(2) + ' miles',
                elevationGain: `${route.elevationGain} m`,
                difficulty: route.difficulty,
                tags: route.tags,
                isPublic: route.isPublic,
                totalCompletions: route.totalCompletions,
                uniqueCompleters: route.uniqueCompleters,
                averageTime: route.averageTime,
                fastestCompletionTime: route.fastestCompletionTime,
                estimatedTime: route.estimatedTime,
                createdAt: route.createdAt
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching route'
        });
    }
});

// ========== UPDATE ROUTE (Creator Only) ==========
router.put('/:id', auth, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);

        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }

        // Only creator can update
        if (route.creator.toString() !== req.user.userId) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'Only route creator can update this route'
            });
        }

        const { name, description, tags, isPublic, estimatedTime } = req.body;

        if (name) route.name = name;
        if (description !== undefined) route.description = description;
        if (tags) route.tags = tags;
        if (isPublic !== undefined) route.isPublic = isPublic;
        if (estimatedTime !== undefined) route.estimatedTime = estimatedTime;

        route.updatedAt = new Date();
        await route.save();

        res.json({
            message: 'Route updated successfully',
            route: {
                id: route._id,
                name: route.name,
                isPublic: route.isPublic
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error updating route'
        });
    }
});

// ========== DELETE ROUTE (Creator Only) ==========
router.delete('/:id', auth, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);

        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }

        // Only creator can delete
        if (route.creator.toString() !== req.user.userId) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'Only route creator can delete this route'
            });
        }
        // Delete all attempts for this route
        await RouteAttempt.deleteMany({ route: route._id });

        await Route.findByIdAndDelete(req.params.id);

        res.json({ message: 'Route and all attempts deleted successfully' });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error deleting route'
        });
    }
});

// ========== RECORD ROUTE ATTEMPT ==========
router.post('/:id/attempt', auth, async (req, res) => {
    try {
        const { activityId, completionTime } = req.body;

        // Validate required fields
        if (!activityId || !completionTime) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Activity ID and completion time required'
            });
        }

        // Validate completion time
        if (completionTime <= 0) {
            return res.status(400).json({
                status: 'error',
                code: 'INVALID_COMPLETION_TIME',
                message: 'Completion time must be positive'
            });
        }

        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }

        // Verify activity exists and belongs to user
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Activity not found'
            });
        }
        if (activity.userId.toString() !== req.user.userId) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: 'Activity does not belong to you'
            });
        }

        // Create attempt
        const attempt = new RouteAttempt({
            route: route._id,
            user: req.user.userId,
            activity: activityId,
            completionTime,
            averagePace: route.distance > 0 ? completionTime / 60 / route.distance : 0
        });

        await attempt.save();

        // ========== UPDATE ROUTE STATS (Business Logic - Stays in Route Handler) ==========

        // Increment total completions
        route.totalCompletions += 1;

        // Check if this is a new completer (first time user completed this route)
        const previousAttempts = await RouteAttempt.countDocuments({
            route: route._id,
            user: req.user.userId
        });
        
        if (previousAttempts === 1) { // Just recorded first attempt
            route.uniqueCompleters += 1;
        }

        // Update fastest completion time
        if (!route.fastestCompletionTime || completionTime < route.fastestCompletionTime) {
            route.fastestCompletionTime = completionTime;
        }

        // Update average using running average formula - no memory issues at scale
        const oldAverage = route.averageTime || completionTime;
        const oldCount = route.totalCompletions - 1;
        route.averageTime = ((oldAverage * oldCount) + completionTime) / route.totalCompletions;

        route.updatedAt = new Date();
        await route.save();

        // Check if this is user's personal best
        const userAttempts = await RouteAttempt.find({ 
            route: route._id, 
            user: req.user.userId,
            completed: true 
        }).sort({ completionTime: 1 });

        const isPersonalBest = userAttempts[0]._id.toString() === attempt._id.toString();

        res.status(201).json({
            message: 'Route attempt recorded',
            attempt: {
                id: attempt._id,
                completionTime: `${Math.floor(completionTime / 60)} min ${completionTime % 60} sec`,
                averagePace: `${attempt.averagePace.toFixed(2)} min/mile`,
                isPersonalBest
            },
            routeStats: {
                totalCompletions: route.totalCompletions,
                averageTime: `${Math.floor(route.averageTime / 60)} min`,
                fastestTime: route.fastestCompletionTime ? `${Math.floor(route.fastestCompletionTime / 60)} min` : 'No data'
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error recording route attempt'
        });
    }
});

// ========== GET ROUTE LEADERBOARD ==========
router.get('/:id/leaderboard', auth, async (req, res) => {
    try {
        const { limit = 10, page = 1 } = req.query;

        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }

        // Get fastest attempt for each user
        const leaderboard = await RouteAttempt.aggregate([
            { $match: { route: route._id, completed: true } },
            { $sort: { completionTime: 1 } },
            { $group: {
                _id: '$user',
                fastestTime: { $first: '$completionTime' },
                attemptDate: { $first: '$createdAt' }
            }},
            { $sort: { fastestTime: 1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        ]);

        // Get total count for pagination
        const totalEntries = await RouteAttempt.aggregate([
            { $match: { route: route._id, completed: true } },
            { $group: { _id: '$user' } },
            { $count: 'total' }
        ]);

        const totalCount = totalEntries.length > 0 ? totalEntries[0].total : 0;

        // Fetch all users in one query instead of one per entry
        const userIds = leaderboard.map(entry => entry._id);
        const users = await User.find({ _id: { $in: userIds } }).select('username');
        const userMap = users.reduce((map, user) => {
            map[user._id.toString()] = user.username;
            return map;
        }, {});

        const leaderboardWithUsers = leaderboard.map((entry, index) => {
            const rank = (parseInt(page) - 1) * parseInt(limit) + index + 1;
            return {
                rank,
                username: userMap[entry._id.toString()] || 'Unknown',
                time: `${Math.floor(entry.fastestTime / 60)} min ${entry.fastestTime % 60} sec`,
                date: entry.attemptDate
            };
        });

        res.json({
            route: {
                id: route._id,
                name: route.name,
                distance: route.distance.toFixed(2) + ' miles'
            },
            leaderboard: leaderboardWithUsers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalEntries: totalCount
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching leaderboard'
        });
    }
});

// ========== GET USER'S ROUTE ATTEMPTS ==========
router.get('/:id/my-attempts', auth, async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({
                status: 'error',
                code: 'NOT_FOUND',
                message: 'Route not found'
            });
        }
        const attempts = await RouteAttempt.find({
            route: route._id,
            user: req.user.userId
        })
        .sort({ createdAt: -1 })
        .populate('activity', 'createdAt');

        const personalBest = attempts.length > 0 ? 
            attempts.reduce((best, current) => 
                current.completionTime < best.completionTime ? current : best
            ) : null;

        res.json({
            route: {
                id: route._id,
                name: route.name
            },
            attempts: attempts.map(attempt => ({
                id: attempt._id,
                completionTime: `${Math.floor(attempt.completionTime / 60)} min ${attempt.completionTime % 60} sec`,
                averagePace: `${attempt.averagePace.toFixed(2)} min/mile`,
                date: attempt.createdAt,
                isPersonalBest: personalBest ? attempt._id.toString() === personalBest._id.toString() : false
            })),
            personalBest: personalBest ? 
                `${Math.floor(personalBest.completionTime / 60)} min ${personalBest.completionTime % 60} sec` : 
                'No attempts yet'
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error fetching attempts'
        });
    }
});

module.exports = router;