use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde::Serialize;

pub type ApiResult<T> = Result<Json<T>, ApiError>;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("internal server error")]
    Internal,
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            ApiError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            ApiError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ApiError::Conflict(_) => (StatusCode::CONFLICT, self.to_string()),
            ApiError::Internal => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };
        let body = Json(ErrorBody { error: message });
        (status, body).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db_err) = &err {
            if db_err.is_unique_violation() {
                return ApiError::Conflict("resource already exists".to_string());
            }
        }
        tracing::error!(error = ?err, "database error");
        ApiError::Internal
    }
}

impl From<jsonwebtoken::errors::Error> for ApiError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        tracing::warn!(error = ?err, "jwt error");
        ApiError::Unauthorized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_bad_request() {
        let err = ApiError::BadRequest("oops".to_string());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn maps_other_statuses() {
        let response = ApiError::Unauthorized.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let response = ApiError::Forbidden.into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let response = ApiError::NotFound.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let response = ApiError::Conflict("exists".to_string()).into_response();
        assert_eq!(response.status(), StatusCode::CONFLICT);

        let response = ApiError::Internal.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
