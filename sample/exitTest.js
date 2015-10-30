


var logger = require( '../lib/Logfella.js' ).global.use( 'main' ) ;
var async = require( 'async-kit' ) ;



process.on( 'beforeExit' , function() {
	logger.info( 'Nothing to do, about to end the process...' ) ;
} ) ;



logger.installExitHandlers() ;



//*
process.on( 'uncaughtException' , function( error ) {
	logger.info( 'do something about that exception...' ) ;
	//throw error ;
	async.exit( 2 ) ;
} ) ;
//*/

//throw new Error( 'Something bad happens' ) ;
setTimeout( function() { throw new Error( 'Something bad asynchronously happens' ) ; } , 100 ) ;
setTimeout( function() { logger.info( 'Some scheduled task...' ) ; } , 500 ) ;

//process.

//process.exit( 2 ) ;




