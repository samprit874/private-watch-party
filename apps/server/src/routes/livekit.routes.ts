import { Router } from 'express';
import { LiveKitController } from '../controllers/livekit.controller.js';

export const livekitRouter = Router();

livekitRouter.post('/:roomId/livekit-token', LiveKitController.getToken);
