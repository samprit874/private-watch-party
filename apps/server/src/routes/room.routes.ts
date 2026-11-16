import { Router } from 'express';
import { RoomController } from '../controllers/room.controller.js';

export const roomRouter = Router();

roomRouter.post('/', RoomController.createRoom);
roomRouter.get('/invite/:token', RoomController.getInviteDetails);
roomRouter.post('/join', RoomController.joinRoom);
roomRouter.get('/session', RoomController.getSession);
roomRouter.get('/:slug/participants', RoomController.getParticipants);
roomRouter.get('/:slug/messages', RoomController.getMessages);
