require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');
const { getBlockchainQueue } = require('./utils/blockchainQueue');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const certificadosRouter = require('./routes/certificados');
const emisionesRouter = require('./routes/emisiones');
const usuariosRouter = require('./routes/usuarios');
const dependenciasRouter = require('./routes/dependencias');
const loginRouter = require('./routes/auth');
const fileRouter = require('./routes/files');
const validacionRouter = require('./routes/validacion');
const fontsRouter = require('./routes/fonts');
const signaturesRouter = require('./routes/signatures');
const correosRouter = require('./routes/correos');
const emailsRouter = require('./routes/emails');

const auth = require('./middlewares/auth');


var app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development, or specify your frontend URLs
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:8080',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors());
// app.use(cors(corsOptions));1

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/certs', express.static(path.join(__dirname, 'storage', 'certificates')));
app.use('/img', express.static(path.join(__dirname, 'storage', 'img')));
app.use('/json', express.static(path.join(__dirname, 'storage', 'json')));
app.use('/uploaded-fonts', express.static(path.join(__dirname, 'storage', 'fonts')));
app.use('/test', express.static(path.join(__dirname, 'storage', 'test')));
app.use('/logos', express.static(path.join(__dirname, 'storage', 'logos')));
app.use('/email-assets', express.static(path.join(__dirname, 'public', 'email-assets')));

connectDB();

// Inicializar la cola de blockchain
getBlockchainQueue();

app.use('/auth', loginRouter);
app.use('/', indexRouter);
app.use('/validacion', validacionRouter);

// app.use('/certificados',auth, certificadosRouter);
// app.use('/emisiones', auth, emisionesRouter);
// app.use('/usuarios', auth, usuariosRouter);
// app.use('/dependencias', auth, dependenciasRouter);
// app.use('/files', auth, fileRouter);

app.use('/certificados', certificadosRouter);
app.use('/emisiones', emisionesRouter);
app.use('/usuarios', usuariosRouter);
app.use('/dependencias', dependenciasRouter);
app.use('/files', fileRouter);
app.use('/fonts', fontsRouter);
app.use('/signatures', signaturesRouter);
app.use('/correos', correosRouter);
app.use('/emails', emailsRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  console.error('Error caught by handler:', err);
  
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // For API endpoints, return JSON error
  if (req.path.startsWith('/correos') || req.path.startsWith('/certificados') || req.path.startsWith('/emisiones')) {
    return res.status(err.status || 500).json({
      error: err.message,
      status: err.status || 500,
      details: req.app.get('env') === 'development' ? err : undefined
    });
  }

  // render the error page for other routes
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
