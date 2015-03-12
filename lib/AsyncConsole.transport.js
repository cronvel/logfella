/*
	The Cedric's Swiss Knife (CSK) - CSK logger toolbox

	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/




			/* Async Console transport */



// Load modules
var ConsoleTransport = require( './Console.transport.js' ) ;



// /!\ It looks like it is not possible to stream to stdout in a non-blocking way ATM...



// Empty constructor, it is just there to support instanceof operator
function AsyncConsoleTransport() { throw new Error( "[logger] Cannot create a AsyncConsoleTransport object directly" ) ; }
module.exports = AsyncConsoleTransport ;

// Inherits from ConsoleTransport
AsyncConsoleTransport.prototype = Object.create( ConsoleTransport.prototype ) ;
AsyncConsoleTransport.prototype.constructor = AsyncConsoleTransport ;



AsyncConsoleTransport.create = ConsoleTransport.create ;


