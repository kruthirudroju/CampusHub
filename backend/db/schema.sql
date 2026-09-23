USE campushub;

-- Core users table (students, faculty, admins all live here, differentiated by role)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'faculty', 'admin') NOT NULL,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Faculty current status (one row per faculty user, updated in place)
CREATE TABLE faculty_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL UNIQUE,
  status ENUM('Available', 'In Class', 'In Meeting', 'Out of Office') DEFAULT 'Out of Office',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Student -> Faculty messages with tracking status
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  faculty_id INT NOT NULL,
  subject VARCHAR(200),
  content TEXT NOT NULL,
  status ENUM('Pending', 'Read', 'Answered') DEFAULT 'Pending',
  reply TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  replied_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Maintenance requests
CREATE TABLE maintenance_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reported_by INT NOT NULL,
  category ENUM('Electrical', 'Furniture', 'Internet', 'Cleaning', 'Water', 'Other') NOT NULL,
  location VARCHAR(150) NOT NULL,
  room_number VARCHAR(50),
  description TEXT NOT NULL,
  priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
  status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Rooms available for booking
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(50) NOT NULL UNIQUE,
  room_type ENUM('Classroom', 'Seminar Hall', 'Lab', 'Meeting Room') NOT NULL,
  capacity INT,
  building VARCHAR(100)
);

-- Room booking requests
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  requested_by INT NOT NULL,
  purpose VARCHAR(200),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE
);