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
        if (f&&f.dataValues) {
          const genreId = Number(f.dataValues.genre_id);
          console.log('genre_id: ', genreId);
          
          const releaseDate = new Date(f.dataValues.release_date);
          const fromDate = getYearsShiftDateString(releaseDate, -15);
          const toDate = getYearsShiftDateString(releaseDate, 15);
          
          console.log('fromDate: ', fromDate);
          console.log('toDate: ', toDate);

          getFilmByGenre(genreId, fromDate, toDate, 4)
            .then((results) => {
              if (results) {
                console.log('results: ', results);
                res.json(results);
              } else {
                sendError(res, 404, `Recommendations based on film with id ${filmId} were not found.`);
              }
            })
            .catch((err) => {
              console.error('ERROR: ', err);
              sendError(res, 400, err);
            });
          } else {
            sendError(res, 404, `Film with id ${filmId} is not found.`);
          }
          
        }).catch((err) => {
          console.error('ERROR: ', err);
          sendError(res, 400, err);
        });
          
  } else {
    res.status(403).send('Please provide proper film id.');
  }
}

function sendError(res, code, message) {
  res.status(code, { message });
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
    primaryKey: true
  },
  title: Sequelize.STRING,
  release_date: Sequelize.STRING,
  tagline: Sequelize.STRING,
  revenue: Sequelize.INTEGER,
  budget: Sequelize.INTEGER,
  runtime: Sequelize.INTEGER,
  original_language: Sequelize.STRING,
  status: Sequelize.STRING,
  genre_id: Sequelize.INTEGER,
}, {
  timestamps: false
});

function getFilmById (filmId) {
  return Films.findById(filmId);
}

function getFilmByGenre(genre_id, fromDate, toDate, minRating) {
  return Films.findAll({
    where: { 
      genre_id,
      release_date: {
        $lte: toDate,
        $gte: fromDate
      },
      // rating: {
      //   $gte: minRating
      // }
    },
    raw: true
  });
}

const API_URL = 'http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1';

function getReviews (filmId) {
  request(`${ API_URL }?films=${ filmId }`, (err, response, body) => {
    const reviewedFilms = JSON.parse(body);
    
    console.log(reviewedFilms);
  });
    
}

getReviews(4);
getReviews(0);
getReviews(100);
getReviews(50);

module.exports = app;
