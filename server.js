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

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
  });

// Define Mongoose schema for User
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

// Plugin passport-local-mongoose to User schema
userSchema.plugin(passportLocalMongoose);

// Create User model
const User = mongoose.model('User', userSchema);

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
  });

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
    res.redirect('/login'); // Redirect to the login page if not authenticated
  }
  
  app.get('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
      res.redirect('/login');
    });
  });

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

 // Profile page route
app.get('/profile/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const userProfile = await User.findById(userId).populate('friends');
  
      res.render('profile', { currentUser: req.user, userProfile });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  app.post('/profile/:username/add-friend', isLoggedIn, async (req, res) => {
    try {
      const username = req.params.username;
      const friendUsername = req.body.friendUsername;
  
      // Find the user by username
      const user = await User.findOne({ username: username });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Find the friend by username
      const friend = await User.findOne({ username: friendUsername });
  
      if (!friend) {
        return res.status(404).json({ error: 'Friend not found' });
      }
  
      // Add friend to user's friends list
      await User.findByIdAndUpdate(user._id, { $addToSet: { friends: friend._id } });
  
      res.redirect(`/profile/${username}`);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
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

  // Render the registration form
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Create a new user
        const newUser = new User({ username });

        // Register the user with Passport
        await User.register(newUser, password);

        // Redirect to the login page after successful registration
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        // Handle registration error, e.g., username already exists
        res.redirect('/register');
    }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
