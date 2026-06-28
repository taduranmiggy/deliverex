/** Full Terms and Conditions of Use — Effective June 2026 */
export const TERMS_AND_CONDITIONS = {
  title: 'Terms and Conditions of Use',
  preamble: 'Please read these Terms and Conditions carefully before using the Deliverex system.',
  effectiveDate: 'June 2026',
  sections: [
    {
      number: 1,
      title: 'Acceptance of Terms',
      blocks: [
        {
          type: 'paragraph',
          text: 'By accessing, registering, or using the Deliverex system — whether through the web application, the Progressive Web Application (PWA), or the native Android mobile application — you agree to be bound by these Terms and Conditions of Use. These terms constitute a legally binding agreement between you and Providential 628 Site Preparation Services, the owner and operator of the Deliverex system.',
        },
        {
          type: 'paragraph',
          text: 'If you do not agree with any provision of these Terms and Conditions, you must not access or use the Deliverex system. Continued use of the system after any amendment to these Terms and Conditions constitutes acceptance of the revised terms.',
        },
        {
          type: 'paragraph',
          text: 'These Terms and Conditions apply in conjunction with the Deliverex Data Privacy Policy, which is incorporated herein by reference and governs the collection, processing, and protection of personal information within the system.',
        },
      ],
    },
    {
      number: 2,
      title: 'Definitions',
      blocks: [
        {
          type: 'paragraph',
          text: 'For the purposes of these Terms and Conditions, the following terms shall have the meanings set forth below:',
        },
        {
          type: 'list',
          items: [
            '"Deliverex" refers to the integrated logistics management system comprising the web application, Progressive Web Application (PWA), and native Android mobile application developed for and operated by Providential 628 Site Preparation Services.',
            '"System" refers to any component or combination of components of Deliverex, including its web application, PWA, mobile application, and associated backend services.',
            '"User" refers to any individual who accesses or uses the Deliverex system in any capacity, including registered and unauthenticated users.',
            '"Customer" refers to a registered user who uses Deliverex to track deliveries and access delivery-related information.',
            '"Driver" refers to a field-based user who uses the Deliverex mobile application to manage delivery job assignments and submit delivery status updates.',
            '"Internal User" refers to a Dispatcher, Administrator, or Manager who uses the Deliverex web application to perform operational, administrative, or supervisory functions.',
            '"Job Order" refers to a structured delivery assignment created and managed within the Deliverex system.',
            '"Tracking ID" refers to the unique identifier assigned to a delivery job order that allows customers to monitor delivery status without authentication.',
            '"Best-Fit Algorithm" refers to the dispatch optimization algorithm used by Deliverex to generate ranked driver-vehicle assignment recommendations.',
            '"OCR" refers to the Optical Character Recognition technology used by Deliverex to extract text from uploaded delivery documents.',
          ],
        },
      ],
    },
    {
      number: 3,
      title: 'User Accounts and Registration',
      subsections: [
        {
          number: '3.1',
          title: 'Account Eligibility',
          blocks: [{
            type: 'paragraph',
            text: 'Customer accounts may be self-registered by individuals who are at least eighteen (18) years of age. By registering, you represent and warrant that the information you provide is accurate, current, and complete. Registration of accounts for internal roles — Dispatcher, Administrator, and Manager — is restricted to authorized personnel of Providential 628 Site Preparation Services and may only be created by a system administrator.',
          }],
        },
        {
          number: '3.2',
          title: 'Account Credentials',
          blocks: [
            {
              type: 'paragraph',
              text: 'You are solely responsible for maintaining the confidentiality of your account credentials, including your email address and password. You must not share your login credentials with any other person. Any activity conducted through your account will be attributed to you and considered authorized by you.',
            },
            {
              type: 'paragraph',
              text: 'You must notify the system administrator immediately if you suspect unauthorized access to or use of your account. The Operator shall not be liable for any loss or damage arising from your failure to protect your account credentials.',
            },
          ],
        },
        {
          number: '3.3',
          title: 'Account Accuracy',
          blocks: [{
            type: 'paragraph',
            text: 'You agree to maintain accurate and up-to-date information in your Deliverex account. The Operator reserves the right to suspend or deactivate accounts that contain false, misleading, or outdated information.',
          }],
        },
        {
          number: '3.4',
          title: 'Account Security',
          blocks: [
            {
              type: 'paragraph',
              text: 'Your account is subject to the following security policies enforced by the Deliverex system:',
            },
            {
              type: 'list',
              items: [
                'Passwords must meet the minimum complexity requirements of at least eight characters, including uppercase, lowercase, numeric, and special characters.',
                'Accounts will be locked after five consecutive failed login attempts. Account recovery is available through email-based verification or administrator-initiated reset.',
                'Sessions are managed through time-limited access tokens, which expire automatically and are renewed without user action within the validity period of your session.',
              ],
            },
          ],
        },
      ],
    },
    {
      number: 4,
      title: 'Authorized Use of the System',
      subsections: [
        {
          number: '4.1',
          title: 'Permitted Use',
          blocks: [{
            type: 'paragraph',
            text: 'The Deliverex system is provided exclusively to support the logistics coordination, delivery monitoring, and documentation management operations of Providential 628 Site Preparation Services. Users are authorized to access and use Deliverex solely for the purposes associated with their designated role as described in Section 5.',
          }],
        },
        {
          number: '4.2',
          title: 'Prohibited Activities',
          blocks: [
            {
              type: 'paragraph',
              text: 'Users must not engage in any of the following activities while using the Deliverex system:',
            },
            {
              type: 'list',
              items: [
                'Accessing data, accounts, modules, or features beyond those assigned to your designated user role.',
                'Attempting to bypass, circumvent, or disable any security measure, access control, authentication mechanism, or role-based restriction implemented in the system.',
                'Submitting false, fabricated, or manipulated data, documents, or delivery records into the system.',
                'Using the system or its data for any purpose outside the operational scope of Providential 628 Site Preparation Services.',
                'Attempting to reverse engineer, decompile, disassemble, or otherwise derive the source code or algorithms of the Deliverex system.',
                'Introducing malicious software, scripts, or code into the system.',
                'Using automated scripts, bots, or tools to scrape, harvest, or extract data from the system without authorization.',
                'Sharing access credentials or allowing unauthorized individuals to access the system through your account.',
                'Using the chatbot or any system feature to submit false, abusive, or misleading inquiries.',
              ],
            },
            {
              type: 'paragraph',
              text: 'Violation of any prohibited activity may result in immediate account suspension, deactivation, and reporting to appropriate legal authorities.',
            },
          ],
        },
      ],
    },
    {
      number: 5,
      title: 'User Roles and Responsibilities',
      subsections: [
        {
          number: '5.1',
          title: 'Administrator',
          blocks: [{
            type: 'paragraph',
            text: 'The Administrator is responsible for managing user accounts, maintaining driver and vehicle master data, validating OCR-processed delivery documents, configuring chatbot content, and reviewing audit logs. The Administrator must ensure that user accounts are created, modified, and deactivated accurately and in a timely manner, and that all data maintained in the system reflects current and accurate operational information.',
          }],
        },
        {
          number: '5.2',
          title: 'Dispatcher',
          blocks: [{
            type: 'paragraph',
            text: 'The Dispatcher is responsible for creating accurate job orders, reviewing Best-Fit algorithm recommendations, assigning drivers and vehicles, and monitoring delivery progress. The Dispatcher must ensure that job order details — including cargo specifications, delivery schedules, and location information — are entered correctly to support accurate dispatch optimization. Override decisions must be made in good faith and documented with a valid override reason.',
          }],
        },
        {
          number: '5.3',
          title: 'Manager',
          blocks: [{
            type: 'paragraph',
            text: 'The Manager has read-only access to delivery records, dashboards, analytics, and reports. The Manager must not attempt to modify operational records or access functions beyond their designated read-only scope. Information accessed through the Manager dashboard must be used solely for operational oversight and performance monitoring within the organization.',
          }],
        },
        {
          number: '5.4',
          title: 'Driver',
          blocks: [{
            type: 'paragraph',
            text: 'The Driver is responsible for accurately and promptly updating delivery statuses through the Deliverex mobile application at each predefined stage of the delivery process. Drivers must capture and submit proof of delivery documents using the OCR feature upon completion of each delivery. Drivers must not submit false status updates or fabricated delivery documents. In offline conditions, drivers are responsible for ensuring that queued data is synchronized with the system upon restoration of connectivity.',
          }],
        },
        {
          number: '5.5',
          title: 'Customer',
          blocks: [{
            type: 'paragraph',
            text: 'The Customer may use Deliverex to track their deliveries using a valid Tracking ID, view their delivery transaction history through their registered account, access proof of delivery documents for completed jobs, and interact with the chatbot for delivery-related inquiries. Customers must not attempt to access delivery records belonging to other customers or to use the system in any manner inconsistent with these Terms and Conditions. Customers may not create, modify, or cancel job orders through any interface of the Deliverex system.',
          }],
        },
      ],
    },
    {
      number: 6,
      title: 'Delivery Tracking and Information',
      blocks: [
        {
          type: 'paragraph',
          text: 'Deliverex provides delivery status tracking based on driver-submitted status updates synchronized when network connectivity is available. The system does not provide continuous real-time GPS tracking of vehicle movements. Delivery status information displayed in the system reflects the most recently submitted driver update and may not represent the instantaneous location or status of the delivery vehicle at any given moment.',
        },
        {
          type: 'paragraph',
          text: 'Estimated distances and route information displayed through the Google Maps integration are calculated based on the driver\'s last known location at the time of the most recent status update and are provided for reference purposes only. Providential 628 Site Preparation Services does not guarantee the accuracy of estimated distances, travel times, or delivery arrival times displayed within the system.',
        },
        {
          type: 'paragraph',
          text: 'The Operator shall not be liable for any loss, inconvenience, or damage arising from delays, inaccuracies, or unavailability of delivery status information within the system due to connectivity limitations, device failures, or circumstances beyond the Operator\'s reasonable control.',
        },
      ],
    },
    {
      number: 7,
      title: 'OCR Document Processing',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Deliverex system uses Optical Character Recognition (OCR) technology to extract text from uploaded delivery documents, including delivery receipts and proof of delivery images. OCR extraction is provided as a supporting tool to assist administrative staff in document validation and is not intended to serve as a fully automated or guaranteed document verification mechanism.',
        },
        {
          type: 'paragraph',
          text: 'The accuracy of OCR extraction results is dependent on the quality, clarity, and format of the uploaded document image. Partial extraction, extraction errors, or unrecognized fields may occur, particularly for documents captured under poor lighting conditions, at low resolution, or with non-standard formatting.',
        },
        {
          type: 'paragraph',
          text: 'All OCR extraction results are subject to review and validation by the designated system administrator before being accepted as verified records. The Operator does not warrant the accuracy or completeness of any OCR extraction output and shall not be liable for any operational, financial, or legal consequences arising from errors in OCR-extracted data that have not been reviewed and validated by an authorized administrator.',
        },
      ],
    },
    {
      number: 8,
      title: 'Chatbot Services',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Deliverex chatbot is provided as a supplementary informational tool accessible through the public website and the native Android mobile application. The chatbot is designed to respond to general inquiries about Deliverex services, provide company contact information, answer frequently asked questions, and retrieve delivery status information using a valid Tracking ID.',
        },
        {
          type: 'paragraph',
          text: 'The chatbot operates based on a predefined set of responses and intent configurations. It does not have access to authenticated user account data, internal operational records, or information beyond what is publicly accessible through the Tracking ID query function. The Operator does not warrant that chatbot responses will be accurate, complete, or applicable to all user inquiries.',
        },
        {
          type: 'paragraph',
          text: 'Users must not use the chatbot to submit false, abusive, harassing, or malicious inquiries. The Operator reserves the right to log chatbot interactions for quality improvement, system configuration, and security review purposes.',
        },
      ],
    },
    {
      number: 9,
      title: 'Intellectual Property',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Deliverex system, including its software architecture, source code, algorithms (including the Best-Fit dispatch optimization algorithm), user interface design, visual elements, documentation, and all associated content, is the intellectual property of Providential 628 Site Preparation Services and the development team. All rights are reserved.',
        },
        {
          type: 'paragraph',
          text: 'Users are granted a limited, non-exclusive, non-transferable, and revocable license to access and use the Deliverex system solely for its intended operational purposes as described in these Terms and Conditions. This license does not grant any right to copy, reproduce, modify, distribute, sell, sublicense, or create derivative works based on the Deliverex system or any of its components.',
        },
        {
          type: 'paragraph',
          text: 'Any unauthorized use, reproduction, or distribution of the Deliverex system or its components may constitute a violation of applicable intellectual property laws and may result in legal action.',
        },
      ],
    },
    {
      number: 10,
      title: 'Data Privacy',
      blocks: [
        {
          type: 'paragraph',
          text: 'The collection, processing, storage, and protection of personal information within the Deliverex system are governed by the Deliverex Data Privacy Policy, issued in compliance with Republic Act No. 10173 or the Data Privacy Act of 2012. The Data Privacy Policy is incorporated into these Terms and Conditions by reference and forms an integral part of the agreement between users and the Operator.',
        },
        {
          type: 'paragraph',
          text: 'By accepting these Terms and Conditions, you also acknowledge that you have read and understood the Deliverex Data Privacy Policy and consent to the processing of your personal information as described therein. A copy of the Data Privacy Policy is accessible at all times through the Deliverex system.',
        },
      ],
    },
    {
      number: 11,
      title: 'System Availability and Maintenance',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Operator endeavors to maintain the availability and reliability of the Deliverex system during regular operational hours. However, the system may be temporarily unavailable due to scheduled maintenance, updates, technical failures, network interruptions, or other circumstances beyond the Operator\'s reasonable control.',
        },
        {
          type: 'paragraph',
          text: 'The Operator shall provide reasonable advance notice of scheduled maintenance where practicable. The Operator shall not be liable for any loss, inconvenience, or damage resulting from system downtime, maintenance periods, or temporary unavailability of any system feature.',
        },
        {
          type: 'paragraph',
          text: 'The Deliverex mobile application is designed with offline capabilities to support field operations in areas with limited or no internet connectivity. However, features requiring server communication — including data synchronization, account authentication, and real-time notification delivery — will be unavailable until connectivity is restored.',
        },
      ],
    },
    {
      number: 12,
      title: 'Disclaimer of Warranties',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Deliverex system is provided on an "as is" and "as available" basis. To the fullest extent permitted by applicable law, the Operator makes no representations or warranties of any kind, express or implied, regarding the system\'s operation, accuracy, reliability, completeness, or fitness for a particular purpose.',
        },
        {
          type: 'paragraph',
          text: 'The Operator does not warrant that:',
        },
        {
          type: 'list',
          items: [
            'The system will be available continuously, uninterrupted, or error-free at all times.',
            'All information displayed in the system, including delivery status, estimated distances, and OCR extraction results, will be accurate, complete, or current at all times.',
            'The Best-Fit algorithm will produce optimal assignments under all possible dispatch conditions or edge cases.',
            'The chatbot will provide accurate or complete responses to all user inquiries.',
            'The system will be free from security vulnerabilities, unauthorized access, or data breaches under all circumstances.',
          ],
        },
      ],
    },
    {
      number: 13,
      title: 'Limitation of Liability',
      blocks: [
        {
          type: 'paragraph',
          text: 'To the fullest extent permitted by applicable law, Providential 628 Site Preparation Services, its officers, employees, agents, and development team shall not be liable for any direct, indirect, incidental, consequential, special, or punitive damages arising out of or related to:',
        },
        {
          type: 'list',
          items: [
            'Your access to or use of, or inability to access or use, the Deliverex system or any of its features.',
            'Errors, inaccuracies, or omissions in delivery status information, OCR extraction results, dispatch recommendations, or chatbot responses.',
            'Unauthorized access to or alteration of your account data resulting from your failure to maintain the confidentiality of your credentials.',
            'System unavailability, downtime, or data loss resulting from technical failures, maintenance, or circumstances beyond the Operator\'s reasonable control.',
            'Decisions made by dispatchers based on Best-Fit algorithm recommendations, including any override decisions and their operational consequences.',
            'Delivery delays, failures, or disputes arising from operational circumstances outside the scope of the Deliverex system.',
          ],
        },
      ],
    },
    {
      number: 14,
      title: 'Indemnification',
      blocks: [
        {
          type: 'paragraph',
          text: 'You agree to indemnify, defend, and hold harmless Providential 628 Site Preparation Services, its officers, employees, agents, and development team from and against any claims, liabilities, damages, losses, costs, and expenses — including reasonable legal fees — arising out of or related to:',
        },
        {
          type: 'list',
          items: [
            'Your violation of these Terms and Conditions.',
            'Your misuse of the Deliverex system or any of its features.',
            'Your submission of false, inaccurate, or unauthorized data into the system.',
            'Your violation of any applicable law, regulation, or the rights of any third party.',
          ],
        },
      ],
    },
    {
      number: 15,
      title: 'Account Suspension and Termination',
      subsections: [
        {
          number: '15.1',
          title: 'Termination by the Operator',
          blocks: [{
            type: 'paragraph',
            text: 'The Operator reserves the right to suspend or permanently deactivate any user account at any time and without prior notice if the account holder is found to have violated these Terms and Conditions, engaged in prohibited activities, provided false registration information, or compromised the security or integrity of the system.',
          }],
        },
        {
          number: '15.2',
          title: 'Termination by the User',
          blocks: [{
            type: 'paragraph',
            text: 'Customer users may request deactivation of their account at any time by submitting a written request to the system administrator. Account deactivation requests will be processed within a reasonable period and will result in the removal of active session access. Delivery transaction records associated with the account may be retained in accordance with the Deliverex Data Privacy Policy and applicable legal requirements.',
          }],
        },
        {
          number: '15.3',
          title: 'Effect of Termination',
          blocks: [{
            type: 'paragraph',
            text: 'Upon account suspension or deactivation, the user\'s access to the Deliverex system will be immediately revoked. All active sessions associated with the account will be invalidated. The user\'s rights under these Terms and Conditions will cease, with the exception of provisions that by their nature survive termination, including Sections 9 (Intellectual Property), 12 (Disclaimer of Warranties), 13 (Limitation of Liability), and 14 (Indemnification).',
          }],
        },
      ],
    },
    {
      number: 16,
      title: 'Prohibited Use by Minors',
      blocks: [{
        type: 'paragraph',
        text: 'The Deliverex system is intended for use by individuals who are at least eighteen (18) years of age. Customer self-registration by individuals below the age of majority is not permitted without the verified consent of a parent or legal guardian. The Operator does not knowingly collect personal information from minors. If the Operator becomes aware that personal information of a minor has been collected without appropriate consent, the account will be deactivated and the associated data will be deleted.',
      }],
    },
    {
      number: 17,
      title: 'Third-Party Services',
      blocks: [{
        type: 'paragraph',
        text: 'The Deliverex system integrates certain third-party services to support its functionality, including Google Maps Platform for delivery destination mapping and distance calculation, and cloud hosting services for data storage and system operation. Your use of features powered by these third-party services is also subject to the terms of service and privacy policies of the respective service providers. The Operator does not control and is not responsible for the terms, policies, or practices of third-party service providers. The Operator shall not be liable for any issues arising from the unavailability, changes, or discontinuation of third-party services used by Deliverex.',
      }],
    },
    {
      number: 18,
      title: 'Governing Law and Dispute Resolution',
      blocks: [{
        type: 'paragraph',
        text: 'These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of the Philippines, including but not limited to Republic Act No. 10173 (Data Privacy Act of 2012), Republic Act No. 8792 (Electronic Commerce Act of 2000), and other applicable Philippine laws and regulations. Any dispute arising out of or in connection with these Terms and Conditions, including any question regarding its existence, validity, or termination, shall be resolved through good-faith negotiation between the parties. If negotiation fails, the dispute shall be submitted to the appropriate courts of the Philippines having jurisdiction over the matter.',
      }],
    },
    {
      number: 19,
      title: 'Changes to These Terms and Conditions',
      blocks: [{
        type: 'paragraph',
        text: 'The Operator reserves the right to update, modify, or revise these Terms and Conditions at any time as required by changes in applicable laws, regulations, system features, or operational requirements. In the event of material changes, registered users will be notified through the Deliverex system or via email prior to the changes taking effect. Your continued use of the Deliverex system following the effective date of any amendment constitutes your acceptance of the revised Terms and Conditions. If you do not agree with the revised terms, you must cease using the system and request account deactivation in accordance with Section 15.',
      }],
    },
    {
      number: 20,
      title: 'Severability',
      blocks: [{
        type: 'paragraph',
        text: 'If any provision of these Terms and Conditions is found to be unlawful, void, or unenforceable by a court of competent jurisdiction, that provision shall be deemed severable from the remaining provisions and shall not affect the validity and enforceability of the remaining Terms and Conditions, which shall continue in full force and effect.',
      }],
    },
    {
      number: 21,
      title: 'Entire Agreement',
      blocks: [{
        type: 'paragraph',
        text: 'These Terms and Conditions, together with the Deliverex Data Privacy Policy, constitute the entire agreement between you and Providential 628 Site Preparation Services with respect to your use of the Deliverex system and supersede all prior agreements, understandings, representations, or warranties relating to the subject matter hereof.',
      }],
    },
    {
      number: 22,
      title: 'Contact Information',
      blocks: [{
        type: 'paragraph',
        text: 'For questions, concerns, or requests related to these Terms and Conditions, please contact:',
      }],
    },
  ],
  contact: {
    organization: 'Providential 628 Site Preparation Services',
    system: 'Deliverex',
    contact: 'System Administrator',
    email: 'deliverex.support@gmail.com',
    address: '7353 CASA ZARAGOZA CLUSTER 3 COMMONWEALTH AVENUE EXTENSION SAN BENISSA GARDEN VILLAS KALIGAYAHAN DISTRICT 5, QUEZON CITY 1124',
  },
  closing: 'By accessing or using the Deliverex system, you confirm that you have read, understood, and agree to be bound by these Terms and Conditions of Use.',
  copyright: '© 2026 Providential 628 Site Preparation Services. All rights reserved.',
}
