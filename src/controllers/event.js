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
                  
                  console.error("create event error", error)
                  res.status(500).json({ success: false,
                        message: 'Error creating event', 
                        error: error.message });
            } finally {
session.endSession();
            }
      }

      async uploadCodes(req, res){
            const session = await mongoose.startSession();
            try {
                  session.startTransaction();

                  const { id } = req.params;

                  const event = await Event.findById(id).session(session);

                  if (!event){
                        await session.abortTransaction();
                        return res.status(404).json({
                              success: false,
                              message: "Event not found"
                        });
                  }

                  if (!req.file){
                        await session.abortTransaction();
                  return res.status(400).json({
                        success: false,
                        message: "Please upload a CSV file"
                  });        
            }

            const codes = [];

            await new Promise((resolve, reject)=>{
                  Readable.from(req.file.buffer).pipe(csvParser()).on("data", (row) => {
                        const code = row.code?.trim();

                        if (code){
                              codes.push({
                                    event: event._id,
                                    code,
                              });
                        }
                  })
                  .on("end", resolve)
                  .on("error", reject);
            })

            if (codes.length === 0) {
                  await session.abortTransaction();
                  return res.status(400).json({
                        success: false,
                        message: "No valid ticket codes found in the uploaded file"
                  });
            }

            // Bulk insert

            const insertedCodes = await TicketCode.insertMany(codes, {session,
                  ordered: false,
            });

            await session.commitTransaction();

            return res.status(201).json({
success: true,
message: "Ticket codes uploaded successfully",
inserted: insertedCodes.length,
            })

            } catch(error) {
                  await session.abortTransaction();
                  res.status(500).json({ 
                        success: false,
                        message: 'Failed to upload ticket codes',
                        error: error.message });
            } finally {
                  await session.endSession();
            }
      }
}

export default new EventController();