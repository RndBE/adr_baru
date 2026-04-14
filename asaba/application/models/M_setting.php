<?php
class M_setting extends CI_Model {

	function __construct(){
		parent::__construct();
		$this->db = $this->load->database('default', true);
	}
	
	function add_rumusdebit($data)
	{
		$this->db->insert('rumus_debit',$data);
		return;

	}
}