const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const path = require('path')

// Create an Express app
const app = express();
const port = 3001;

app.use(express.static(path.join(__dirname, 'public')));

// Use express-session middleware
app.use(session({
    secret: '1234',
    resave: false,
    saveUninitialized: false
  }));

// Use passport middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));

// Define Mongoose schema for User
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

// Plugin passport-local-mongoose to User schema
userSchema.plugin(passportLocalMongoose);

// Create User model
const User = mongoose.model('User', userSchema);

// Set passport strategy
// Set passport strategy
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to parse JSON requests
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Connect to MongoDB using Mongoose
mongoose.connect('mongodb://localhost/blogDB', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define Mongoose schema for Comment
const commentSchema = new mongoose.Schema({
  body: String
});

// Define Mongoose schema for BlogPost
const blogPostSchema = new mongoose.Schema({
    title: String,
    body: String,
    comments: [{
      body: String
    }]
  });
  
  const BlogPost = mongoose.model('BlogPost', blogPostSchema);

// Middleware to parse JSON requests
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.redirect('/blog');
})

// Route to create a new blog post
app.post('/blog', async (req, res) => {
    try {
      const { title, body, comments } = req.body;
      
      // Create a new blog post
      const newPost = new BlogPost({
        title,
        body,
        comments
      });
  
      // Save the new post to the database
      await newPost.save();
  
      res.status(201).json({ message: 'Blog post created successfully', post: newPost });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Route to render the main page with all blog posts
  app.get('/blog', async (req, res) => {
      try {
        // Fetch all blog posts from the database
        const posts = await BlogPost.find();
    
        // Render the EJS view for the main page
        res.render('index', { posts });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });  

// Route to render the login form
app.get('/login', (req, res) => {
    res.render('login');
  });
  
  // Route to handle login logic
  app.post('/login', passport.authenticate('local', {
    successRedirect: '/blog',
    failureRedirect: '/login'
  }));
  
  // Route middleware to ensure user is logged in
  function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect('/login');
  }
  
// Route to render the form for creating a new blog post (requires authentication)
app.get('/blog/new', isLoggedIn, (req, res) => {
    res.render('newpost');
  });
  
  // Route to handle creating a new blog post
 // Route to handle creating a new blog post
 app.post('/blog/new', isLoggedIn, async (req, res) => {
    try {
      const { title, body } = req.body;
  
      // Create a new blog post
      const newPost = new BlogPost({
        title,
        body,
        comments: [] // Assuming comments is an array
      });
  
      // Save the new post to the database
      await newPost.save();
  
      // Redirect to /blog after saving the post
      res.redirect('/blog');
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Route to render the form for creating a new comment (requires authentication)
  app.get('/comment/new', isLoggedIn, (req, res) => {
    res.render('newcomment');
  });
  
  // Route to handle creating a new comment
  app.post('/comment/new', isLoggedIn, async (req, res) => {
    // ... (previous code to create a new comment)
  });
  
  // Route to render the registration form
app.get('/register', (req, res) => {
    res.render('register');
  });
  
// Route to handle user registration logic
app.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Create a new user instance
      const newUser = new User({ username });
  
      // Set the password for the user
      newUser.setPassword(password, async () => {
        try {
          // Save the user to the database
          await newUser.save();
  
          // Log in the newly registered user
          req.login(newUser, (loginErr) => {
            if (loginErr) {
              console.error(loginErr);
              return res.status(500).json({ error: 'Internal Server Error' });
            }
  
            return res.redirect('/blog');
          });
        } catch (saveError) {
          console.error(saveError);
          res.status(500).json({ error: 'Internal Server Error' });
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Route to handle adding a comment to a specific post
app.post('/blog/:postId/comment', isLoggedIn, async (req, res) => {
    try {
      const postId = req.params.postId;
      const { commentBody } = req.body;
  
      // Find the post by ID
      const post = await BlogPost.findById(postId);
  
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
  
      // Add the new comment to the post
      post.comments.push({ body: commentBody });
  
      // Save the updated post
      await post.save();
  
      // Redirect back to the individual post page
      res.redirect(`/blog/${postId}`);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Route to render an individual post
app.get('/blog/:postId', async (req, res) => {
    try {
      const postId = req.params.postId;
  
      // Find the post by ID
      const post = await BlogPost.findById(postId);
  
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
  
      // Render the EJS view for the individual post
      res.render('post', { post });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });  
    
// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});