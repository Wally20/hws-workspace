from django.templatetags.static import static
from jinja2 import Environment, select_autoescape


def environment(**options):
    options.setdefault(
        "autoescape",
        select_autoescape(
            enabled_extensions=("html", "htm", "xml"),
            default_for_string=True,
        ),
    )
    env = Environment(
        **options,
    )
    env.globals.update(
        static=static,
    )
    return env
