# MongoDB Setup Guide

## Prerequisites

1. **MongoDB Installation**

   - Install MongoDB locally or use MongoDB Atlas (cloud)
   - For local installation: https://docs.mongodb.com/manual/installation/
   - For MongoDB Atlas: https://www.mongodb.com/atlas

2. **Node.js Dependencies**
   - Run `npm install` to install mongoose and other dependencies

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/telegram_payment_bot

# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=https://your-domain.com

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Ragapay Configuration
RAGAPAY_TEST_KEY=your_ragapay_test_key_here
RAGAPAY_PASSWORD=your_ragapay_password_here
RAGAPAY_ENDPOINT=https://checkout.ragapay.com/api/v1/session

# Admin Configuration
MASTER_ADMIN_ID=your_telegram_user_id_here
```

## Database Schema

The application uses three main collections:

### 1. Admins Collection

- **userId**: String (unique) - Telegram user ID
- **role**: String (enum: "admin", "masteradmin") - Admin role
- **name**: String - Admin display name
- **createdAt**: Date - Creation timestamp
- **updatedAt**: Date - Last update timestamp

### 2. Products Collection

- **title**: String - Product name
- **description**: String - Product description
- **amount**: Number - Product price
- **currency**: String (enum: "USD", "EUR", "GBP", "INR") - Currency
- **createdBy**: String - Admin user ID who created the product
- **isActive**: Boolean - Whether product is active
- **createdAt**: Date - Creation timestamp
- **updatedAt**: Date - Last update timestamp

### 3. Payments Collection

- **userId**: String - Telegram user ID
- **chatId**: String - Telegram chat ID
- **orderNumber**: String (unique) - Payment order number
- **amount**: Number - Payment amount
- **currency**: String - Payment currency
- **status**: String (enum: "pending", "completed", "failed", "cancelled")
- **checkoutUrl**: String - Ragapay checkout URL
- **productId**: ObjectId (optional) - Reference to Product
- **productName**: String (optional) - Product name
- **transactionId**: String (optional) - Transaction ID
- **paymentId**: String (optional) - Payment ID
- **billingAddress**: Object - Customer billing address
- **createdAt**: Date - Creation timestamp
- **updatedAt**: Date - Last update timestamp
- **completedAt**: Date (optional) - Completion timestamp

## Running the Application

1. **Start MongoDB** (if running locally):

   ```bash
   mongod
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Start the Application**:
   ```bash
   npm run dev
   ```

## Database Initialization

The application will automatically:

- Connect to MongoDB on startup
- Create the master admin user if it doesn't exist
- Create necessary indexes for optimal performance

## Data Persistence

All data is now persisted in MongoDB:

- Admin users and roles
- Product catalog
- Payment history and status
- User sessions (with in-memory cache for performance)

## Migration from In-Memory Storage

The application has been migrated from in-memory storage to MongoDB. All existing functionality remains the same, but data will now persist across application restarts.

## Troubleshooting

1. **Connection Issues**:

   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify network connectivity

2. **Permission Issues**:

   - Ensure MongoDB user has read/write permissions
   - Check database access rights

3. **Performance Issues**:
   - Monitor MongoDB performance
   - Consider adding more indexes if needed
   - Use MongoDB Atlas for production scaling
