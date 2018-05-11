const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  const filmId = Number(req.params.id);
  console.log('filmId',filmId);
  if (filmId) {
    getFilmById(filmId)
      .then((f) => {
        console.log('FILM: ', f.dataValues);
        if (f.dataValues) {
          res.json(f.dataValues);
        } else {
          res.status(404, { message: `Film with id ${filmId} is not found.` });
        }
        
      }).catch((err) => {
        console.error('ERROR: ', err);
        res.status(400)(f.dataValues);
      });
  } else {
    res.status(403).send('Please provide proper film id.');
  }
}

// SQL functions ==============================================================
const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: DB_PATH,
});

// Define SQL models
const Films = sequelize.define('films', {
  id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  },
  title: Sequelize.STRING
}, {
  timestamps: false
});

function getFilmById(filmId) {
  return Films.findById(filmId);
}

module.exports = app;
