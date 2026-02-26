// rules_default.js – AdmitGuard Default Eligibility Rules Config
// This is the system default. Each batch can override this config.

const DEFAULT_RULES_CONFIG = {
  full_name: {
    type: "strict",
    min_length: 2,
    no_numbers: true,
    label: "Full Name"
  },
  email: {
    type: "strict",
    format: "email",
    label: "Email"
  },
  phone: {
    type: "strict",
    pattern: "indian_mobile",
    label: "Phone"
  },
  date_of_birth: {
    type: "soft",
    min_age: 18,
    max_age: 35,
    label: "Date of Birth"
  },
  qualification: {
    type: "strict",
    allowed: ["B.Tech", "B.E", "B.Sc", "BCA", "M.Tech", "M.Sc", "MCA", "MBA"],
    label: "Highest Qualification"
  },
  graduation_year: {
    type: "soft",
    min: 2015,
    max: 2025,
    label: "Graduation Year"
  },
  percentage_cgpa: {
    type: "soft",
    min_percent: 60.0,
    min_cgpa: 6.0,
    label: "Percentage / CGPA"
  },
  screening_score: {
    type: "soft",
    min: 40,
    max: 100,
    label: "Screening Test Score"
  },
  interview_status: {
    type: "strict",
    allowed: ["Cleared", "Waitlisted", "Rejected"],
    label: "Interview Status"
  },
  aadhaar: {
    type: "strict",
    digits: 12,
    label: "Aadhaar Number"
  },
  offer_letter: {
    type: "strict",
    depends_on: { interview_status: ["Cleared", "Waitlisted"] },
    label: "Offer Letter Sent"
  }
};