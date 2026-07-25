CREATE DATABASE blolab_presence;
USE blolab_presence;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    role ENUM('admin', 'apprenant') NOT NULL,
    filiere VARCHAR(100),
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE presences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date_jour DATE NOT NULL,
    heure TIME NOT NULL,
    statut ENUM('Present', 'Retard') NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    distance_m DECIMAL(10, 2),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE config (
    cle VARCHAR(100) PRIMARY KEY,
    valeur VARCHAR(255)
);

INSERT INTO config (cle, valeur) VALUES
('blolab_latitude', '6.3703'),
('blolab_longitude', '2.3912'),
('rayon_metres', '100'),
('heure_limite_retard', '09:00:00'),
('qr_code_jour', 'BLOLAB-ENTREE-2026');