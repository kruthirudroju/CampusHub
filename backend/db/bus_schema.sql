USE campushub;

CREATE TABLE bus_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_number VARCHAR(20) NOT NULL UNIQUE,
  route_name VARCHAR(150),
  gps_link VARCHAR(255),
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  incharge1_name VARCHAR(100),
  incharge1_phone VARCHAR(20),
  incharge2_name VARCHAR(100),
  incharge2_phone VARCHAR(20)
);

CREATE TABLE bus_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  stop_order INT NOT NULL,
  stop_name VARCHAR(150) NOT NULL,
  stop_time VARCHAR(20),
  FOREIGN KEY (bus_id) REFERENCES bus_routes(id) ON DELETE CASCADE
);