-- Optional customer notes to help the salon prepare for each appointment.
ALTER TABLE bookings ADD COLUMN appointmentDetails TEXT NOT NULL DEFAULT '';
