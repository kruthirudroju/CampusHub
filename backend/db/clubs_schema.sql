USE campushub;

CREATE TABLE clubs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_name VARCHAR(150) NOT NULL UNIQUE,
  club_type ENUM('Technical', 'Cultural') NOT NULL,
  coordinator_id INT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE club_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  type ENUM('Event', 'Contest', 'Announcement') NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);