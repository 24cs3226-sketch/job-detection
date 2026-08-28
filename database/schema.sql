-- ============================================
-- Fake Job & Internship Detection System
-- Database Schema (MySQL)
-- ============================================

CREATE DATABASE IF NOT EXISTS fake_job_detector;
USE fake_job_detector;

-- ------------------------------------------------
-- Table 1: scan_history
-- Stores every job/internship text or image that
-- was checked, along with the verdict and score.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    input_type ENUM('text', 'image') NOT NULL DEFAULT 'text',
    original_text TEXT NOT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    risk_score INT NOT NULL DEFAULT 0,
    verdict ENUM('REAL', 'SUSPICIOUS', 'FAKE') NOT NULL,
    matched_flags TEXT,                 -- JSON string of red-flags found
    image_path VARCHAR(500) DEFAULT NULL,
    ip_address VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- Table 2: known_companies
-- A safety whitelist/blacklist of companies, used
-- to cross-check the company name mentioned in a post.
-- status: 'trusted', 'blacklisted', 'unknown'
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS known_companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL UNIQUE,
    official_domain VARCHAR(255) DEFAULT NULL,
    status ENUM('trusted', 'blacklisted', 'unknown') NOT NULL DEFAULT 'unknown',
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- Table 3: red_flag_keywords
-- Configurable keyword list that powers the
-- rule-based detection engine. Each keyword has a
-- weight (how suspicious it is) and a category.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS red_flag_keywords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,      -- e.g. 'payment', 'urgency', 'grammar', 'contact'
    weight INT NOT NULL DEFAULT 10,      -- how many risk points this adds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- Seed data: some well-known trusted companies
-- ------------------------------------------------
INSERT INTO known_companies (company_name, official_domain, status, notes) VALUES
('TCS', 'tcs.com', 'trusted', 'Tata Consultancy Services'),
('Infosys', 'infosys.com', 'trusted', 'Verified IT company'),
('Wipro', 'wipro.com', 'trusted', 'Verified IT company'),
('Accenture', 'accenture.com', 'trusted', 'Verified MNC'),
('Google', 'google.com', 'trusted', 'Verified MNC'),
('Microsoft', 'microsoft.com', 'trusted', 'Verified MNC'),
('Amazon', 'amazon.com', 'trusted', 'Verified MNC'),
('Cognizant', 'cognizant.com', 'trusted', 'Verified IT company'),
('HCL Technologies', 'hcltech.com', 'trusted', 'Verified IT company'),
('Zoho', 'zoho.com', 'trusted', 'Verified Indian company')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ------------------------------------------------
-- Seed data: red flag keywords used by the rule engine
-- ------------------------------------------------
INSERT INTO red_flag_keywords (keyword, category, weight) VALUES
('registration fee', 'payment', 25),
('processing fee', 'payment', 25),
('security deposit', 'payment', 25),
('pay before joining', 'payment', 30),
('refundable deposit', 'payment', 20),
('send money', 'payment', 30),
('western union', 'payment', 30),
('pay via gpay', 'payment', 25),
('pay via paytm', 'payment', 25),
('investment required', 'payment', 25),
('telegram', 'contact', 15),
('whatsapp only', 'contact', 15),
('no interview', 'process', 20),
('no experience needed earn lakhs', 'process', 20),
('work from home earn daily', 'process', 15),
('urgent hiring', 'urgency', 10),
('limited seats', 'urgency', 10),
('hurry up', 'urgency', 10),
('selected directly', 'process', 15),
('100% job guarantee', 'process', 20),
('earn upto', 'salary', 10),
('earn per day', 'salary', 12),
('part time job earn', 'salary', 10),
('gmail.com', 'email', 12),
('yahoo.com', 'email', 10),
('click this link', 'link', 15),
('bit.ly', 'link', 18),
('tinyurl', 'link', 18),
('aadhar card photo', 'document', 20),
('bank account details', 'document', 25),
('otp', 'document', 25),
('no qualification required', 'process', 12),
('immediate joining no documents', 'process', 18)
ON DUPLICATE KEY UPDATE weight = VALUES(weight);
