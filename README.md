# 🍽️ New Era Cafeteria Management System

A modern, full-featured cafeteria management system built for **Redeemer's University, Ede, Osun State, Nigeria**. This web application streamlines cafeteria operations with role-based access control, real-time order processing, comprehensive reporting, and shift management.

![Built with React](https://img.shields.io/badge/React-18.x-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Convex](https://img.shields.io/badge/Convex-Backend-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)

---

## 🌟 Key Features

### 🔐 **Secure Access Code System**

- Role-based authentication (Admin, Cashier, Morning Shift, Night Shift)
- Time-limited access codes with expiration dates
- Usage tracking for each access code
- Active/inactive status management
- No traditional password system - uses unique access codes

### 👨‍💼 **Admin Dashboard**

Complete administrative control panel with:

### 📊 Analytics & Reports

- **Real-time Statistics**: Total sales, order counts, revenue trends
- **Sales Charts**: Visual representation of daily sales performance
- **Category Analysis**: Track popular menu categories
- **Recent Orders**: Monitor live order activity
- **Export Reports** with multiple formats:
  - Sales Reports (Daily breakdown with shift analysis)
  - Orders Reports (Detailed transaction history)
  - Inventory Reports (Menu items and stock status)
  - Users Reports (Access code usage statistics)
- **Receipt-Style Reports**: Professional 80mm thermal printer format
- **Print Functionality**: Direct print to POS thermal printers

#### 🍔 **Menu Management**

- Add, edit, and delete menu items
- Category organization (Food, Drinks, Snacks)
- Real-time availability toggle
- Price management
- Image support for menu items
- Bulk operations

#### 👥 **User Management**

- Generate access codes for staff
- Assign roles (Admin/Cashier) and shifts (Morning/Night)
- Set expiration dates for temporary access
- Track code usage statistics
- Activate/deactivate codes instantly
- Bulk code generation

### 💰 **Cashier Dashboard**

Optimized point-of-sale interface:

#### 🛒 **Order Processing**

- **Visual Menu Grid**: Category-filtered product display
- **Smart Search**: Quick product lookup
- **Shopping Cart**:
  - Add/remove items
  - Quantity adjustment
  - Real-time total calculation
  - Item notes/customization
- **Payment Methods**: Cash and Transfer support
- **Order Confirmation**: Clear order summary before processing

#### 🧾 **Receipt System**

- **Professional POS Receipts**: 80mm thermal printer format
- **Detailed Order Information**:
  - Cafeteria header with university branding
  - Itemized list with quantities and prices
  - Payment method indicator
  - Date and time stamp
  - Order categorization (Food/Drinks)
- **Print & Download**: Both print and PDF download options
- **Order History**: View past transactions

### 🌓 **Shift Management**

- **Morning Shift**: 6 AM - 6 PM
- **Night Shift**: 6 PM - 6 AM
- Shift-specific access codes
- Separate shift analytics in reports
- Shift-based performance tracking

### 📱 **Responsive Design**

- **Mobile-First Approach**: Optimized for tablets and phones
- **Desktop Support**: Full-featured desktop experience
- **Touch-Friendly**: Perfect for touchscreen POS terminals
- **Mobile Cart**: Slide-out cart on smaller screens

---

## 🛠️ Technology Stack

### **Frontend**

- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Shadcn UI** - Beautiful component library
- **Lucide React** - Icon system
- **Recharts** - Data visualization

### **Backend**

- **Convex** - Real-time backend platform
- **Real-time Queries** - Live data synchronization
- **Mutations** - Secure data operations
- **File Storage** - Image upload support

### **PDF Generation**

- **jsPDF** - PDF document creation
- **jsPDF-AutoTable** - Table generation
- **Custom Thermal Printer Formatting**

### **Date & Time**

- **date-fns** - Modern date utility library

---

## 📦 Installation

### Prerequisites

- Node.js 18+ or Bun runtime
- Convex account (free tier available)

### Setup Steps

1. **Clone the repository**

```bash
git clone <repository-url>
cd "New Era"
```

2. **Install dependencies**

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

3. **Configure Convex**

```bash
# Initialize Convex
npx convex dev

# This will:
# - Create a new Convex project
# - Generate configuration files
# - Start the development server
```

4. **Set up environment variables**
   Create a `.env.local` file:

```env
VITE_CONVEX_URL=your_convex_url_here
```

5. **Seed initial data** (Optional)

```bash
# Generate demo access codes
npx convex run seedAccessCodes

# Import menu items
node importMenuToConvexStandalone.js
```

6. **Start development server**

```bash
bun run dev
# Or: npm run dev
```

7. **Access the application**

```
http://localhost:5173
```

---

## 🚀 Usage Guide

### **First Time Setup**

1. **Generate Admin Access Code**
   - Run: `npx convex run seedAccessCodes`
   - Or use the admin panel to create codes

2. **Access Admin Dashboard**
   - Go to landing page
   - Click "Admin Access"
   - Enter admin access code
   - You'll be redirected to admin dashboard

3. **Set Up Menu Items**
   - Navigate to Menu Management
   - Add categories and items
   - Set prices and availability

4. **Create Cashier Access Codes**
   - Go to User Management
   - Click "Generate Access Code"
   - Select "Cashier" role
   - Choose shift (Morning/Night)
   - Set expiration date (optional)

### **Daily Operations**

#### **For Cashiers:**

1. Access cashier dashboard with your code
2. Browse menu or search for items
3. Add items to cart
4. Adjust quantities as needed
5. Select payment method
6. Process order
7. Print receipt

#### **For Admins:**

1. Monitor real-time sales dashboard
2. Check recent orders
3. Update menu availability
4. Generate shift reports
5. Manage staff access codes
6. Export financial reports

---

## 📊 Report Types

### **Sales Report**

- **Detailed Table View**: Complete transaction breakdown
- **Receipt Style**: Compact POS format (default)
- **Features**:
  - Daily grouping with totals
  - Morning/Night shift breakdown
  - Payment method analysis (Cash vs Transfer)
  - Grand total calculations
  - Date range filtering

### **Orders Report**

- Complete order history
- Itemized transactions
- Customer order details
- Payment method tracking

### **Inventory Report**

- Menu item listing
- Category breakdown
- Availability status
- Price information

### **Users Report**

- Access code directory
- Role assignments
- Shift allocations
- Usage statistics
- Code expiration tracking

---

## 🎨 UI Components

### **Custom Components**

- `AccessCard` - Access code input with role selection
- `FoodSlider` - Animated menu showcase
- `MenuGrid` - Filterable product display
- `Cart` - Shopping cart with totals
- `ReceiptModal` - POS receipt generator
- `StatsCards` - Analytics dashboard
- `SalesChart` - Revenue visualization
- `CategoryChart` - Category performance
- `MenuManagement` - Full CRUD for menu items
- `UserManagement` - Access code administration
- `ExportReports` - Report generation interface

### **Shadcn UI Components**

Full suite including: Button, Card, Dialog, Select, Calendar, Badge, Alert, Toast, and more.

---

## 🔒 Security Features

- **No Password Storage**: Uses unique access codes
- **Role-Based Access Control (RBAC)**
- **Code Expiration**: Time-limited access
- **Usage Tracking**: Monitor code activity
- **Instant Revocation**: Deactivate codes immediately
- **Convex Authentication**: Secure backend

---

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors

**New Era Cafeteria Team**

- Redeemer's University, Ede
- Osun State, Nigeria

---

## 🙏 Acknowledgments

- Redeemer's University for project support
- Convex for real-time backend infrastructure
- Shadcn for beautiful UI components
- The open-source community

---

## 📞 Support

For support, email: support@neweracafeteria.com  
Or visit: [University Website]

---

## 🗺️ Roadmap

### Upcoming Features

- [ ] SMS notifications for orders
- [ ] Email receipt delivery
- [ ] Loyalty program
- [ ] Online pre-ordering
- [ ] Inventory auto-reorder
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Analytics export to Excel/CSV
- [ ] Mobile app (React Native)
- [ ] QR code ordering

---

## 📸 Screenshots

### Landing Page

_Modern landing page with access code entry_

### Admin Dashboard

_Comprehensive analytics and management tools_

### Cashier Interface

_Streamlined POS system for fast order processing_

### Receipt Output

_Professional thermal printer receipts_
