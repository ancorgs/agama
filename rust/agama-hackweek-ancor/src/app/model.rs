use std::time::Duration;
// tuirealm
use tuirealm::event::NoUserEvent;
use tuirealm::props::{AttrValue, Attribute, PropPayload, PropValue, TextSpan};
use tuirealm::terminal::TerminalBridge;
use tuirealm::State;
use tuirealm::{Application, EventListenerCfg, Update};
// tui
use tuirealm::tui::layout::{Constraint, Direction as LayoutDirection, Layout};
// Agama
use agama_lib::connection;
use agama_lib::storage::{StorageClient, StorageDevice, StorageSettings, StorageStore};
// Internal
use super::components::{SelectDevice, TextareaActions};
use super::{Id, Msg};

pub struct Model {
    pub quit: bool,   // Becomes true when the user presses <ESC>
    pub redraw: bool, // Tells whether to refresh the UI; performance optimization
    pub available_devices: Vec<StorageDevice>,
    pub proposal_actions: Vec<String>,
    pub settings: StorageSettings,
    pub app: Application<Id, Msg, NoUserEvent>,
}

impl Default for Model {
    fn default() -> Self {
        // Setup app
        let mut app: Application<Id, Msg, NoUserEvent> = Application::init(
            EventListenerCfg::default().default_input_listener(Duration::from_millis(10)),
        );
        assert!(app
            .mount(Id::SelectDevice, Box::new(SelectDevice::default()), vec![])
            .is_ok());
        assert!(app
            .mount(
                Id::TextareaActions,
                Box::new(TextareaActions::default()),
                vec![]
            )
            .is_ok());
        // We need to give focus to input then
        assert!(app.active(&Id::SelectDevice).is_ok());
        Self {
            quit: false,
            redraw: true,
            available_devices: vec![],
            settings: StorageSettings::default(),
            proposal_actions: Vec::from([
                String::from("Action one"),
                String::from("Second action"),
            ]),
            app,
        }
    }
}

impl Model {
    async fn query_available_devices(&self) -> Vec<StorageDevice> {
        let conn = connection().await.unwrap();
        let client = StorageClient::new(conn).await.unwrap();
        client.available_devices().await.unwrap()
    }

    async fn query_settings(&self) -> StorageSettings {
        let conn = connection().await.unwrap();
        let store = StorageStore::new(conn).await.unwrap();
        store.load().await.unwrap()
    }

    async fn save_settings(&self) {
        let conn = connection().await.unwrap();
        let store = StorageStore::new(conn).await.unwrap();
        store.store(&self.settings).await.unwrap();
    }

    fn device_names(&self) -> Vec<&String> {
        self.available_devices.iter().map(|x| &x.name).collect()
    }

    fn set_textarea_text(&mut self, id: &Id, lines: Vec<PropValue>) {
        assert!(self
            .app
            .attr(
                id,
                Attribute::Text,
                AttrValue::Payload(PropPayload::Vec(lines))
            )
            .is_ok());
    }

    fn set_select_content(&mut self, id: &Id, items: Vec<PropValue>) {
        assert!(self
            .app
            .attr(
                id,
                Attribute::Content,
                AttrValue::Payload(PropPayload::Vec(items))
            )
            .is_ok());
    }

    fn set_select_value(&mut self, id: &Id, value: usize) {
        assert!(self
            .app
            .attr(
                id,
                Attribute::Value,
                AttrValue::Payload(PropPayload::One(PropValue::Usize(value)))
            )
            .is_ok());
    }

    fn select_items(&self, values: &Vec<&String>) -> Vec<PropValue> {
        values
            .iter()
            .map(|x| PropValue::Str(x.to_string()))
            .collect()
    }

    fn textarea_lines(&self, lines: &Vec<String>) -> Vec<PropValue> {
        lines
            .iter()
            .map(|x| PropValue::TextSpan(TextSpan::from(x)))
            .collect()
    }

    fn boot_device_idx(&self) -> Option<usize> {
        if let Some(ref device_name) = self.settings.boot_device {
            return self.available_devices.iter().position(|d| &d.name == device_name);
        }
        None
    }

    pub fn init(&mut self) {
        self.available_devices = futures::executor::block_on(self.query_available_devices());
        self.settings = futures::executor::block_on(self.query_settings());

        let items = self.select_items(&self.device_names());
        self.set_select_content(&Id::SelectDevice, items);
        if let Some(i) = self.boot_device_idx() {
            self.set_select_value(&Id::SelectDevice, i);
        }
        let lines = self.textarea_lines(&self.proposal_actions);
        self.set_textarea_text(&Id::TextareaActions, lines);
    }

    pub fn view(&mut self, terminal: &mut TerminalBridge) {
        let select_device_len = match self.app.state(&Id::SelectDevice) {
            Ok(State::One(_)) => 3,
            _ => 5,
        };
        let _ = terminal.raw_mut().draw(|f| {
            // Prepare chunks
            let chunks = Layout::default()
                .direction(LayoutDirection::Vertical)
                .margin(1)
                .constraints(
                    [
                        Constraint::Length(select_device_len),
                        Constraint::Length(12),
                        Constraint::Length(1),
                    ]
                    .as_ref(),
                )
                .split(f.size());
            self.app.view(&Id::SelectDevice, f, chunks[0]);
            self.app.view(&Id::TextareaActions, f, chunks[1]);
        });
    }
}

impl Update<Msg> for Model {
    fn update(&mut self, msg: Option<Msg>) -> Option<Msg> {
        self.redraw = true;
        match msg.unwrap_or(Msg::None) {
            Msg::AppClose => {
                self.quit = true;
                None
            }
            Msg::SelectDeviceBlur => {
                assert!(self.app.active(&Id::TextareaActions).is_ok());
                None
            }
            Msg::TextareaActionsBlur => {
                assert!(self.app.active(&Id::SelectDevice).is_ok());
                None
            }
            Msg::SelectDeviceChanged(index) => {
                if let Some(device) = self.available_devices.get(index) {
                    self.settings.boot_device = Some(device.name.to_string());
                    futures::executor::block_on(self.save_settings());
                }
                None
            }
            Msg::None => None,
        }
    }
}
