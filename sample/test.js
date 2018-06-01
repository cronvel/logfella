


var Logfella = require( '../lib/Logfella.js' ) ;
var log = Logfella.global.use( 'main' ) ;

Logfella.global.configure( {
	transports: [
		{ type: 'console' , output: 'stdout' } ,
		{ type: 'file' , path: 'log/error.log' } ,
		{ type: 'scatteredFiles' , path: 'log' } ,
		{ type: 'netServer' } ,
//		{ type: 'console' , output: 'stderr' }
	]
} ) ;

setInterval( () => {
	log.warning( "Ouch!" ) ;
	log.fatal( "Fatal error: %E" , new Error( "Fatal error!" ) ) ;
	//log.trace( "Trace!" ) ;
} , 1500 ) ;