// // ROUTE HANDLER
// function getFilmRecommendations(req, res) {
//     const filmId = Number(req.params.id);
//     if (filmId) {
//       getFilmById(filmId)
//         .then((f) => {
//           if (f && f.dataValues) {
//             console.log('FILM: ', f.dataValues);
//             const genreId = Number(f.dataValues.genre_id);
//             console.log('genre_id: ', genreId);
            
//             const releaseDate = new Date(f.dataValues.release_date);
//             const fromDate = getYearsShiftDateString(releaseDate, -15);
//             const toDate = getYearsShiftDateString(releaseDate, 15);
            
//             console.log('fromDate: ', fromDate);
//             console.log('toDate: ', toDate);
  
//             getFilmByGenre(genreId, fromDate, toDate, 4)
//               .then((results) => {
//                 if (results) {
//                   console.log('results: ', results);
//                   res.json(results);
//                 } else {
//                   sendError(res, 404, `Recommendations based on film with id ${filmId} were not found.`);
//                 }
//               })
//               .catch((err) => {
//                 console.error('ERROR: ', err);
//                 sendError(res, 400, err);
//               });
            
//           } else {
//             sendError(res, 404, `Film with id ${filmId} is not found.`);
//           }
          
//         }).catch((err) => {
//           console.error('ERROR: ', err);
//           sendError(res, 400, err);
//         });
//     } else {
//       sendError(res, 403, 'Please provide proper film id.');
//     }
//   }
  
//   function sendError(res, code, message) {
//     res.status(code, { message });
//   }
  
//   function getYearsShiftDateString(date, shift) {
//     const localDate = new Date(date);
//     const newDate = new Date(localDate.setFullYear(date.getFullYear() + shift));
//     return newDate.toISOString().split('T')[0];
//   }
  
//   // SQL functions ==============================================================
//   const sequelize = new Sequelize('main', null, null, {
//     dialect: 'sqlite',
//     storage: DB_PATH,
//   });
  
//   // Define SQL models
//   const Films = sequelize.define('films', {
//     id: {
//       type: Sequelize.INTEGER,
//       primaryKey: true
//     },
//     title: Sequelize.STRING,
//     release_date: Sequelize.STRING,
//     tagline: Sequelize.STRING,
//     revenue: Sequelize.INTEGER,
//     budget: Sequelize.INTEGER,
//     runtime: Sequelize.INTEGER,
//     original_language: Sequelize.STRING,
//     status: Sequelize.STRING,
//     genre_id: Sequelize.INTEGER,
//   }, {
//     timestamps: false
//   });
  
//   function getFilmById(filmId) {
//     return Films.findById(filmId);
//   }
  
//   function getFilmByGenre(genre_id, fromDate, toDate, minRating) {
//     return Films.findAll({
//       where: { 
//         genre_id,
//         release_date: {
//           $lte: toDate,
//           $gte: fromDate
//         },
//         // rating: {
//         //   $gte: minRating
//         // }
//       },
//       raw: true
//     });
//   }