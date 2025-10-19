# Flask Web Server Template

A complete Flask web application template with user authentication, SQLite3 database integration, and Bootstrap styling.

## Features

- **User Authentication**: Registration, login, logout functionality
- **Password Security**: Werkzeug password hashing
- **SQLite3 Database**: Lightweight database for user storage
- **Session Management**: Secure user sessions
- **Protected Routes**: Login required decorator
- **Bootstrap UI**: Clean and responsive design
- **Flash Messages**: User feedback system

## Project Structure

```
flask-webserver-template/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── database.db           # SQLite database (created automatically)
└── templates/
    ├── base.html         # Base template
    ├── index.html        # Home page
    ├── login.html        # Login page
    ├── register.html     # Registration page
    └── dashboard.html    # User dashboard
```

## Installation

1. **Clone or download this template**

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

5. **Open your browser** and navigate to `http://localhost:5000`

## Usage

### First Time Setup

1. Start the application
2. The SQLite database (`database.db`) will be created automatically
3. Navigate to the registration page to create your first user account
4. Login with your credentials to access the dashboard

### Routes

- `/` - Home page
- `/login` - User login
- `/register` - User registration
- `/dashboard` - Protected user dashboard (login required)
- `/logout` - User logout

### Customization

#### Database Schema

The user table includes:
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email address
- `password_hash` - Hashed password
- `created_at` - Timestamp

To modify the schema, update the `init_db()` function in `app.py`.

#### Adding New Routes

Add new routes in `app.py`:

```python
@app.route('/new-page')
@login_required  # Optional: require login
def new_page():
    return render_template('new_page.html')
```

#### Styling

The template uses Bootstrap 5. Customize styles by:
- Modifying the `<style>` section in `base.html`
- Adding custom CSS files
- Updating Bootstrap classes in templates

#### Security

**Important**: Before deploying to production:

1. Change the secret key in `app.py`:
   ```python
   app.secret_key = 'your-secure-random-secret-key'
   ```

2. Set `debug=False` when running the app
3. Use environment variables for sensitive configuration
4. Consider using a more robust database like PostgreSQL

## Dependencies

- **Flask**: Web framework
- **Werkzeug**: Password hashing and security utilities

## Development

To extend this template:

1. Add new routes in `app.py`
2. Create corresponding HTML templates in the `templates/` folder
3. Update the navigation in `base.html` if needed
4. Modify the database schema as required

## License

This template is free to use and modify for your projects.