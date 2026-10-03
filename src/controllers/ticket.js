import Event  from '../models/event.js'
import mongoose from 'mongoose'
import TicketCode from '../models/ticket.js'
import csvParser from 'csv-parser';
import { Readable} from "stream"

class TicketController {

      async batchUploadTickets(req, res){
            const session = await mongoose.startSession();
            try {
                  session.startTransaction();
                  const { id } = req.params;
                  const event = await Event.findById(id);
                  if (!req.file){
                        await session.abortTransaction();
                  return res.status(400).json({
                        success: false,
                        message: "Please upload a CSV file"
                  });        
            }

            const codes = [];

            await new Promise((resolve, reject)=>{
                  Readable.from(req.file.buffer).pipe(csvParser({
                        mapHeaders: ({ header }) => header.trim().toLowerCase(),
                  })).on("data", (row) => {

                        const code = (row.code || row.Code || row.CODE || "").trim();
                        if (code){
                              codes.push({
                                    code_string: code,
                                    event_id: event._id,
                                    source: "CSV"
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

            const insertedCodes = await TicketCode.insertMany(codes, {session,
                  ordered: false,
            });

            await session.commitTransaction();

            return res.status(200).json({
                  success: true,
                  message: "Ticket codes uploaded successfully",
                  inserted: insertedCodes.length,
            });

            } catch(error) {
                  await session.abortTransaction();
                  if (error.code === 11000) {
                        return res.status(400).json({
                              success: false,
                              message: 'Duplicate ticket code found'
                        });
                  }
                  res.status(500).json({ 
                        success: false,
                        message: 'Failed to upload ticket codes',
                        error: error.message });
            } finally {
                  await session.endSession();
            }
      }

      async bulkDeleteTickets(req, res){
            const session = await mongoose.startSession();
            try {
                  session.startTransaction();
                  const { id } = req.params;

                  const event = await Event.findById(id);

                  if (!event){
                         await session.abortTransaction();
                        session.endSession();
                          return res.status(400).json({ 
                                          success: false,
                                          message: 'Event not found',  
                                    })
                  }
                  const bulkTicket = await TicketCode.deleteMany(
                        { event_id: id }, { session }
                  )

                  await session.commitTransaction();

                  return res.status(201).json({
                        success: true, 
                        message: "Bulk ticket codes deleted successfully", 
                        deleted: bulkTicket.deletedCount
                  })

            }catch(error) {
                  await session.abortTransaction();
                  res.status(500).json({ success: false,
                        message: 'Error bulk deleting ticket codes', 
                        error: error.message });
            } finally {
                  session.endSession();
            }
      }
}

export default new TicketController();