import Event from '../models/event.js'
import mongoose from 'mongoose'
import TicketCode from '../models/ticket.js'
import csvParser from 'csv-parser';
import { Readable } from "stream";
import uploadToCloudinary from '../utils/uploadToCloudinary.js'
class EventController {
     async createEvent(req, res) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const {
            name,
            description,
            date,
            startAt,
            venue,
            status,
            organizer_id
        } = req.body;


        if (
            !name ||
            !description ||
            !date ||
            !startAt ||
            !venue ||
            !organizer_id
        ) {
            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message: "All fields are required",
                data: null
            });
        }

        if (!req.file) {
            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message: "Image is required, please upload an image"
            });
        }

        const uploadResult = await uploadToCloudinary(
            req.file.buffer
        );

        const imageUrl = uploadResult.secure_url;

        const event = await Event.create(
            [{
                name: name.trim(),
                description: description.trim(),
                date,
                startAt,
                venue: venue.trim(),
                image: imageUrl,
                status,
                organizer_id
            }],
            { session }
        );

        await session.commitTransaction();

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: event[0]
        });

    } catch (error) {

        await session.abortTransaction();

        console.error("CREATE EVENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Error creating event",
            error: error.message
        });

    } finally {
        await session.endSession();
    }
}

      async getAllEvents(req, res) {
            try {
                  const events = await Event.find().sort({ createdAt: -1 });

                  if (!events) {
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

            } catch (error) {

                  res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

      async getEventById(req, res) {
            try {
                  const { id } = req.params;

                  const event = await Event.findById(id);

                  if (!event) {
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
            } catch (error) {
                  return res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

      async deleteEvent(req, res) {
            try {
                  const id = req.params.id;

                  const event = await Event.findByIdAndDelete(id);

                  if (!event) {
                        return res.status(404).json({
                              success: false,
                              message: "No event with this id found"
                        })
                  }

                  return res.status(200).json({
                        success: true,
                        message: "Event deleted successfully"
                  })

            } catch (error) {
                  return res.status(500).json({
                        success: false,
                        message: error.message
                  })
            }
      }

      async updateEvent(req, res) {
            const session = await mongoose.startSession();
            try {
                  session.startTransaction();

                  const { name, description, date, startAt, venue } = req.body;

                  if (!name || !description || !date || !startAt || !venue) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(400).json({
                              success: false,
                              message: "All fields are required",
                              data: null
                        });
                  }

                  const { id } = req.params;
                  const event = await Event.findById(id);

                  if (!event) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(400).json({
                              success: false,
                              message: "No event found with this id",
                              data: null
                        });
                  }

                  event.name = name;
                  event.description = description;
                  event.date = date;
                  event.startAt = startAt;
                  event.venue = venue;

                  await event.save();

                  await session.commitTransaction();

                  return res.status(200).json({
                        success: true,
                        message: "Event details updated successfully",
                        data: event
                  })

            } catch (error) {
                  await session.abortTransaction();
                  res.status(500).json({
                        success: false,
                        message: 'Error updating event',
                        error: error.message
                  });
            } finally {
                  session.endSession();
            }
      }

      async batchUploadTickets(req, res) {
                  const session = await mongoose.startSession();
                  try {
                        session.startTransaction();

                        const { id } = req.params;
                        const event = await Event.findById(id).session(session);

                        if (!req.file) {
                              await session.abortTransaction();
                              return res.status(400).json({
                                    success: false,
                                    message: "Please upload a CSV file"
                              });
                        }

                        if (!event) {
                              await session.abortTransaction();

                              return res.status(404).json({
                                    success: false,
                                    message: "Event not found"
                              });
                        }
      
                        const codes = [];
      
                        await new Promise((resolve, reject) => {
                              Readable.from(req.file.buffer).pipe(csvParser({
                                    mapHeaders: ({ header }) => header.trim().toLowerCase(),
                              })).on("data", (row) => {
      
                                    const code = (row.code || row.Code || row.CODE || "").trim();
                                    if (code) {
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
      
                        const insertedCodes = await TicketCode.insertMany(codes, {
                              session,
                              ordered: false,
                        });
      
                        await session.commitTransaction();
      
                        return res.status(200).json({
                              success: true,
                              message: "Ticket codes uploaded successfully",
                              inserted: insertedCodes.length,
                        });
      
                  } catch (error) {
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
                              error: error.message
                        });
                  } finally {
                        await session.endSession();
                  }
            }

      async getEventTickets(req, res) {
            try {
            const { id } = req.params;

            const tickets = await TicketCode.find({
                  event_id: id
            }).sort({ status: 1 }).select("-event_id -qr_token -source");

            if (tickets.length === 0){
                return res.status(404).json({
                  success: false,
                  message: "No ticket found for this event",   
            });  
            }

            return res.status(200).json({
                  success: true,
                  count: tickets.length,
                  tickets
            });

            } catch (error) {
            return res.status(500).json({
                  success: false,
                  message: "Failed to retrieve event tickets",
                  error: error.message
            });
            }
}
      
      async bulkDeleteTickets(req, res) {
                  const session = await mongoose.startSession();
                  try {
                        session.startTransaction();
                        const { id } = req.params;
      
                        const event = await Event.findById(id).session(session);
      
                        if (!event) {
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

                        if (bulkTicket.deletedCount === 0) {
                              await session.abortTransaction();

                              return res.status(404).json({
                                    success: false,
                                    message: "No ticket codes found for this event",
                                    deleted: 0
                              });
                        }
                        await session.commitTransaction();
      
                        return res.status(201).json({
                              success: true,
                              message: "Bulk ticket codes deleted successfully",
                              deleted: bulkTicket.deletedCount
                        })
      
                  } catch (error) {
                        await session.abortTransaction();
                        res.status(500).json({
                              success: false,
                              message: 'Error bulk deleting ticket codes',
                              error: error.message
                        });
                  } finally {
                        session.endSession();
                  }
            }
}

export default new EventController();