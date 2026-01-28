import sanitizeHtml from 'sanitize-html';
import mongoose from 'mongoose';

function sanitizeHTMLPlugin(schema) {
  schema.pre('validate', function (next) {
    const stringPaths = Object.keys(schema.paths).filter(
      (path) => schema.paths[path].instance === 'String'
    );

    const foundInvalid = stringPaths.some((path) => {
      const original = this[path];

      if (typeof original !== 'string') return false;

      const clean = sanitizeHtml(original, {
        allowedTags: [],
        allowedAttributes: {},
      });

      if (clean !== original) {
        const validationError = new mongoose.Error.ValidationError(this);
        validationError.addError(
          path,
          new mongoose.Error.ValidatorError({
            path,
            message: `${path} must not contain HTML`,
            value: original,
          })
        );

        next(validationError);
        return true;
      }

      this[path] = clean;
      return false;
    });

    if (!foundInvalid) next();
  });
}

export default sanitizeHTMLPlugin;
