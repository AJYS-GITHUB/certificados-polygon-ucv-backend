require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const connectDB = require('./config/db');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const certificadosRouter = require('./routes/certificados');
const emisionesRouter = require('./routes/emisiones');
const usuariosRouter = require('./routes/usuarios');
const dependenciasRouter = require('./routes/dependencias');
const loginRouter = require('./routes/auth');
const fileRouter = require('./routes/files');
const validacionRouter = require('./routes/validacion');

const auth = require('./middlewares/auth');


var app = express();

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

connectDB();

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

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
