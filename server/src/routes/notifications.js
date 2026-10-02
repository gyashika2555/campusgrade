import { Router } from "express";
import Notification from "../models/Notification.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate("actor", "campusId name role")
      .populate("assignment", "assignmentCode title dueAt")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) { next(error); }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { readAt: new Date() },
      { new: true },
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (error) { next(error); }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    const result = await Notification.updateMany({ recipient: req.user.id, readAt: null }, { readAt: new Date() });
    res.json({ updated: result.modifiedCount });
  } catch (error) { next(error); }
});

export default router;
