IF DB_ID('SLBFE_Coursework') IS NULL
BEGIN
    CREATE DATABASE SLBFE_Coursework;
END
GO

USE SLBFE_Coursework;
GO

IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
IF OBJECT_ID('dbo.CitizenDocuments', 'U') IS NOT NULL DROP TABLE dbo.CitizenDocuments;
IF OBJECT_ID('dbo.CitizenContacts', 'U') IS NOT NULL DROP TABLE dbo.CitizenContacts;
IF OBJECT_ID('dbo.Qualifications', 'U') IS NOT NULL DROP TABLE dbo.Qualifications;
IF OBJECT_ID('dbo.Citizens', 'U') IS NOT NULL DROP TABLE dbo.Citizens;
GO

CREATE TABLE dbo.Citizens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    national_id NVARCHAR(20) NOT NULL UNIQUE,
    full_name NVARCHAR(120) NOT NULL,
    role NVARCHAR(20) NOT NULL
        CONSTRAINT CK_Citizens_Role CHECK (role IN ('citizen', 'job_seeker', 'officer', 'company', 'staff')),
    age INT NOT NULL CONSTRAINT CK_Citizens_Age CHECK (age BETWEEN 16 AND 100),
    address NVARCHAR(255) NOT NULL,
    current_latitude DECIMAL(10, 7) NULL,
    current_longitude DECIMAL(10, 7) NULL,
    profession NVARCHAR(100) NULL,
    affiliation NVARCHAR(150) NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    is_verified BIT NOT NULL CONSTRAINT DF_Citizens_IsVerified DEFAULT 0,
    verification_notes NVARCHAR(500) NULL,
    verified_by INT NULL,
    verified_at DATETIME2 NULL,
    is_active BIT NOT NULL CONSTRAINT DF_Citizens_IsActive DEFAULT 1,
    deactivated_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Citizens_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Citizens_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Citizens_VerifiedBy FOREIGN KEY (verified_by) REFERENCES dbo.Citizens(id)
);
GO

CREATE TABLE dbo.Qualifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    citizen_id INT NOT NULL,
    qualification_name NVARCHAR(150) NOT NULL,
    institution NVARCHAR(150) NULL,
    year_completed INT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Qualifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Qualifications_Citizen FOREIGN KEY (citizen_id) REFERENCES dbo.Citizens(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.CitizenDocuments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    citizen_id INT NOT NULL,
    document_type NVARCHAR(50) NOT NULL,
    original_name NVARCHAR(255) NOT NULL,
    stored_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    mime_type NVARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    uploaded_at DATETIME2 NOT NULL CONSTRAINT DF_CitizenDocuments_UploadedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CitizenDocuments_Citizen FOREIGN KEY (citizen_id) REFERENCES dbo.Citizens(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.CitizenContacts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    citizen_id INT NOT NULL,
    contact_name NVARCHAR(120) NOT NULL,
    relationship NVARCHAR(60) NOT NULL,
    phone NVARCHAR(30) NOT NULL,
    email NVARCHAR(150) NULL,
    address NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_CitizenContacts_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CitizenContacts_Citizen FOREIGN KEY (citizen_id) REFERENCES dbo.Citizens(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Complaints (
    id INT IDENTITY(1,1) PRIMARY KEY,
    citizen_id INT NOT NULL,
    subject NVARCHAR(150) NOT NULL,
    content NVARCHAR(2000) NOT NULL,
    reply NVARCHAR(2000) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_Complaints_Status DEFAULT 'open',
    replied_by INT NULL,
    replied_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Complaints_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Complaints_Status CHECK (status IN ('open', 'replied', 'closed')),
    CONSTRAINT FK_Complaints_Citizen FOREIGN KEY (citizen_id) REFERENCES dbo.Citizens(id),
    CONSTRAINT FK_Complaints_RepliedBy FOREIGN KEY (replied_by) REFERENCES dbo.Citizens(id)
);
GO

CREATE INDEX IX_Citizens_RoleVerified ON dbo.Citizens(role, is_verified, is_active);
CREATE INDEX IX_Qualifications_Name ON dbo.Qualifications(qualification_name);
CREATE INDEX IX_Complaints_Status ON dbo.Complaints(status, created_at DESC);
GO
