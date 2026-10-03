import Event  from '../models/event.js'
import mongoose from 'mongoose'
import TicketCode from '../models/ticket.js'
import csvParser from 'csv-parser';
import { Readable} from "stream"

class EventController {
      async createEvent(req, res ) {
            const session = await mongoose.startSession();
            try {
                  session.startTransaction();
                  const { name, date, venue, status, organizer_id } = req.body;

                  if (!name || !date || !venue || !status || !organizer_id) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(400).json({
                              success: false,
                              message: "All fields are required",
                              data: null
                        });
                  }

                  const event = await Event.create([{
                        name: name.trim(),
                        date, 
                        venue: venue.trim(), 
                        status, 
                        organizer_id
                  }], { session });

                  await session.commitTransaction();
                  session.endSession()

                  return res.status(201).json({
                        success: true, 
                        message: "Event created successfully", 
                        data: event[0]
                  })

            } catch(error) {
                  await session.abortTransaction();
                  res.status(500).json({ success: false,
                        message: 'Error creating event', 
                        error: error.message });
            } finally {
                  session.endSession();
            }
      }

      async getAllEvents (req, res){
            try {
                  const events = await Event.find();

                  if (!events){
                        return res.status(404).json({
                              success: false,
                              message: "No event found"
                        })
                  }

                  return res.status(200).json({
                        success: true,
                        message: "All events fetched successfully",
                        event: events
                  })

            } catch(error){

                  res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

      async getEventById(req, res){
            try {
                  const id = req.params.id;

                  const event = await Event.findById(id);

                  if (!event){
                        return res.status(404).json({
                              success: false,
                              message: "No event found with this id"
                        })
                  }

                  return res.status(200).json({
                        success: true,
                        message: "Event found and fetched sucessfully",
                        event: event
                  })
            } catch(error){
                    return res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

      async deleteEvent(req, res){
            try {
                  const id = req.params.id;

                  const event = await Event.findByIdAndDelete(id);

                  if (!event){
                        return res.status(404).json({
                              success: false,
                              message: "No event with this id found"
                        })
                  }

                  return res.status(200).json({
                        success: true,
                        message: "Event deleted successfully"
                  })

            } catch(error){
                  return res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

}

export default new EventController();