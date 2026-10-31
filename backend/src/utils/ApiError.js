class ApiError extends Error {
    constructor(statusCode, message, details){
        super(message);
        this.statusCode=statusCode;
    }
}