use tui_realm_stdlib::Select;
use tuirealm::command::{Cmd, CmdResult, Direction};
use tuirealm::props::{Alignment, BorderType, Borders, Color};
use tuirealm::{
    event::{Key, KeyEvent},
    Component, Event, MockComponent, NoUserEvent, State, StateValue
};
// Internal
use super::Msg;

#[derive(MockComponent)]
pub struct SelectDevice {
    component: Select,
}

impl Default for SelectDevice {
    fn default() -> Self {
        Self {
            component: Select::default()
                .borders(
                    Borders::default()
                        .modifiers(BorderType::Rounded)
                        .color(Color::LightGreen),
                )
                .foreground(Color::LightGreen)
                .title("Select Target Device", Alignment::Center)
                .rewind(true)
                .highlighted_color(Color::LightGreen)
                .highlighted_str(">> "),
        }
    }
}

impl Component<Msg, NoUserEvent> for SelectDevice {
    fn on(&mut self, ev: Event<NoUserEvent>) -> Option<Msg> {
        let cmd_result = match ev {
            Event::Keyboard(KeyEvent {
                code: Key::Down, ..
            }) => self.perform(Cmd::Move(Direction::Down)),
            Event::Keyboard(KeyEvent { code: Key::Up, .. }) => {
                self.perform(Cmd::Move(Direction::Up))
            }
            Event::Keyboard(KeyEvent {
                code: Key::Enter, ..
            }) => self.perform(Cmd::Submit),
            Event::Keyboard(KeyEvent {
                code: Key::Delete | Key::Backspace,
                ..
            }) => self.perform(Cmd::Cancel),
            Event::Keyboard(KeyEvent { code: Key::Tab, .. }) => return Some(Msg::SelectDeviceBlur),
            Event::Keyboard(KeyEvent { code: Key::Esc, .. }) => return Some(Msg::AppClose),
            _ => CmdResult::None,
        };
        match cmd_result {
            CmdResult::Changed(State::One(StateValue::Usize(index))) => {
                Some(Msg::SelectDeviceChanged(index))
            },
            _ => Some(Msg::None)
        }
    }
}
