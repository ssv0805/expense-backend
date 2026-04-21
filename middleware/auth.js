const Session = require("../models/session");

const auth = async (req, res, next) => {
    try {
        const sessionId = req.cookies.sessionId;

        if (!sessionId) {
            return res.status(401).json({
                message: "Unauthorized! Please login"
            });
        }

        const session = await Session.findOne({ sessionId });

        if (!session) {
            return res.status(401).json({
                message: "Session expired or invalid"
            });
        }

        req.user = { email: session.email };

        next();
    } catch (err) {
        console.log("AUTH ERROR:", err);
        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = auth;