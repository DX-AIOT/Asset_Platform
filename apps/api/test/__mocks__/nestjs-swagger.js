// No-op stubs for @nestjs/swagger so unit tests resolve without the package installed.
// Decorators are metadata-only; they have no effect on test logic.

const noop = () => () => {};

class DocumentBuilder {
  setTitle() { return this; }
  setDescription() { return this; }
  setVersion() { return this; }
  addBearerAuth() { return this; }
  addCookieAuth() { return this; }
  addServer() { return this; }
  build() { return {}; }
}

class SwaggerModule {
  static createDocument() { return {}; }
  static setup() {}
}

function PartialType(Parent) {
  class Partial extends Parent {}
  return Partial;
}

module.exports = {
  ApiTags: noop,
  ApiOperation: noop,
  ApiResponse: noop,
  ApiBearerAuth: noop,
  ApiCookieAuth: noop,
  ApiBody: noop,
  ApiParam: noop,
  ApiQuery: noop,
  ApiProperty: noop,
  ApiPropertyOptional: noop,
  ApiHeader: noop,
  ApiExcludeEndpoint: noop,
  ApiExcludeController: noop,
  ApiHideProperty: noop,
  DocumentBuilder,
  SwaggerModule,
  PartialType,
};
